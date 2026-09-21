# frozen_string_literal: true

require "singleton"

class LiveEngine
  include Singleton

  MAX_TICKS = 48
  MAX_CLIENTS = 32
  MAX_ENTRIES = 100
  TICK_SECONDS = Sim::TICK_SECONDS
  STREAM = "linelock_feed"

  def initialize
    @mutex = Mutex.new
    @games = {}
    @props = {}
    @history = {}
    @projections = {}
    @entries = []
    @seq = 0
    @entry_seq = 0
    @final_ticks = 0
    @timer = nil
    reset_slate!
  end

  def reset_slate!
    @mutex.synchronize do
      @entries = []
      @seq = 0
      @entry_seq = 0
      seed_board
    end
  end

  def start!
    @mutex.synchronize do
      return if @timer

      @timer = Thread.new do
        Thread.current.abort_on_exception = true
        loop do
          sleep TICK_SECONDS
          tick!
        end
      end
    end
  end

  def stop!
    @mutex.synchronize do
      @timer&.kill
      @timer = nil
    end
  end

  def running?
    @mutex.synchronize { !@timer.nil? }
  end

  def health
    {
      "ok" => true,
      "product" => "LineLock",
      "backend" => "rails",
      "feed" => running? ? "running" : "stopped",
      "seq" => @seq,
      "memory" => memory
    }
  end

  def snapshot
    @mutex.synchronize { snapshot_unlocked }
  end

  def get_prop(id)
    @mutex.synchronize do
      prop = @props[id]
      return nil unless prop

      prop.merge("history" => @history[id].to_a)
    end
  end

  def list_entries
    @mutex.synchronize { @entries.last(20).reverse }
  end

  def submit_entry(legs)
    @mutex.synchronize do
      result = EntryValidator.new(legs, @props).validate
      return result unless result[:ok]

      @entry_seq += 1
      entry = {
        "id" => "ent_#{@entry_seq}",
        "createdAt" => Slate.now_ms,
        "legs" => result[:legs],
        "multiplier" => result[:multiplier],
        "status" => "pending"
      }
      @entries << entry
      @entries.shift while @entries.length > MAX_ENTRIES
      { ok: true, entry: entry }
    end
  end

  # One simulated tick. Public so specs can drive the clock without waiting.
  def tick!
    batch = nil
    @mutex.synchronize do
      advance_clocks

      updates = []
      @props.each_value do |prop|
        game = @games[prop["gameId"]]
        next if game.nil?
        next unless advance_prop(prop, game)

        prop["updatedAt"] = Slate.now_ms
        tick = { "t" => prop["updatedAt"], "line" => prop["line"], "liveStat" => prop["liveStat"] }
        @history[prop["id"]].push(tick)
        updates << { "id" => prop["id"], "prop" => prop.dup, "tick" => tick }
      end

      if restart_if_slate_is_over
        updates = @props.values.map do |prop|
          tick = { "t" => prop["updatedAt"], "line" => prop["line"], "liveStat" => prop["liveStat"] }
          { "id" => prop["id"], "prop" => prop.dup, "tick" => tick }
        end
      end

      next if updates.empty?

      @seq += 1
      batch = { "type" => "batch", "seq" => @seq, "updates" => updates }
    end

    return unless batch

    ActionCable.server.broadcast(STREAM, batch)
    SocketHub.broadcast(batch.to_json)
    batch
  end

  private

  def seed_board
    @games = {}
    @props = {}
    @history = {}
    @projections = {}
    @final_ticks = 0

    Slate.games.each { |game| @games[game["id"]] = game }

    Slate.seed.each do |seed|
      game = @games[seed["gameId"]]
      next if game.nil?

      prop = seed.merge(
        "gameStatus" => game["status"],
        "clock" => Sim.clock_label(game["sport"], game["status"], game["elapsedSec"], game["startLabel"]),
        "liveStat" => nil,
        "updatedAt" => Slate.now_ms
      )
      unless game["status"] == "scheduled"
        projected = Sim.project_final(prop["line"], prop["stat"])
        @projections[prop["id"]] = projected
        progress = Sim.game_progress(game["sport"], game["elapsedSec"])
        prop["liveStat"] = Sim.opening_stat(projected, prop["stat"], progress)
      end

      @props[prop["id"]] = prop
      buf = RingBuffer.new(MAX_TICKS)
      buf.push({ "t" => prop["updatedAt"], "line" => prop["line"], "liveStat" => prop["liveStat"] })
      @history[prop["id"]] = buf
    end
  end

  def advance_clocks
    @games.each_value do |game|
      case game["status"]
      when "scheduled"
        game["startsInSec"] -= Sim::GAME_SECONDS_PER_TICK
        tip_off(game) if game["startsInSec"] <= 0
      when "live"
        regulation = Sim.regulation_seconds(game["sport"])
        game["elapsedSec"] = [ game["elapsedSec"] + Sim::GAME_SECONDS_PER_TICK, regulation ].min
        game["status"] = "final" if game["elapsedSec"] >= regulation
      end
    end
  end

  def tip_off(game)
    game["status"] = "live"
    game["elapsedSec"] = 0
    game["startsInSec"] = 0
    @props.each_value do |prop|
      next unless prop["gameId"] == game["id"]

      @projections[prop["id"]] = Sim.project_final(prop["line"], prop["stat"])
      prop["liveStat"] = 0
    end
  end

  # Applies one tick to a prop. Returns whether anything a client can see changed.
  def advance_prop(prop, game)
    if game["status"] == "scheduled"
      return false if rand >= Sim::PREGAME_LINE_NUDGE_CHANCE

      prop["line"] = Sim.nudge_line(prop["line"], prop["openingLine"])
      return true
    end

    return false if prop["gameStatus"] == "final"

    projected = @projections[prop["id"]] || 0
    progress = Sim.game_progress(game["sport"], game["elapsedSec"])
    prop["liveStat"] = Sim.advance_stat(prop["liveStat"] || 0, projected, prop["stat"], progress)

    if game["status"] == "final"
      prop["liveStat"] = projected
      prop["gameStatus"] = "final"
      prop["clock"] = "Final"
      return true
    end

    prop["gameStatus"] = "live"
    prop["clock"] = Sim.clock_label(game["sport"], game["status"], game["elapsedSec"], game["startLabel"])
    prop["line"] = Sim.nudge_line(prop["line"], prop["openingLine"]) if rand < Sim::LIVE_LINE_NUDGE_CHANCE
    true
  end

  # Once every game is final the board would freeze, so reseed after a short hold.
  def restart_if_slate_is_over
    unless @games.each_value.all? { |game| game["status"] == "final" }
      @final_ticks = 0
      return false
    end

    @final_ticks += 1
    return false if @final_ticks < Sim::RESTART_AFTER_TICKS

    seed_board
    true
  end

  def snapshot_unlocked
    props = @props.values.map do |prop|
      prop.merge("history" => @history[prop["id"]].to_a)
    end
    {
      "seq" => @seq,
      "generatedAt" => Slate.now_ms,
      "props" => props,
      "memory" => memory_unlocked
    }
  end

  def memory
    @mutex.synchronize { memory_unlocked }
  end

  def memory_unlocked
    tick_count = @history.values.sum(&:length)
    {
      "maxTicksPerProp" => MAX_TICKS,
      "propCount" => @props.size,
      "tickCount" => tick_count,
      "clientCap" => MAX_CLIENTS
    }
  end
end
