# frozen_string_literal: true

require "singleton"

class LiveEngine
  include Singleton

  MAX_TICKS = 48
  MAX_CLIENTS = 32
  MAX_ENTRIES = 100
  TICK_MS = 0.9
  STREAM = "linelock_feed"

  def initialize
    @mutex = Mutex.new
    @props = {}
    @history = {}
    @entries = []
    @seq = 0
    @entry_seq = 0
    @timer = nil
    reset_slate!
  end

  def reset_slate!
    @mutex.synchronize do
      @props = {}
      @history = {}
      @entries = []
      @seq = 0
      @entry_seq = 0
      Slate.seed.each do |prop|
        @props[prop["id"]] = prop
        buf = RingBuffer.new(MAX_TICKS)
        buf.push({ "t" => prop["updatedAt"], "line" => prop["line"], "liveStat" => prop["liveStat"] })
        @history[prop["id"]] = buf
      end
    end
  end

  def start!
    @mutex.synchronize do
      return if @timer

      @timer = Thread.new do
        loop do
          sleep TICK_MS
          tick!
        end
      end
      @timer.abort_on_exception = true
    end
  end

  def stop!
    @mutex.synchronize do
      @timer&.kill
      @timer = nil
    end
  end

  def running?
    !@timer.nil?
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

  def tick!
    batch = nil
    @mutex.synchronize do
      ids = @props.keys
      live_ids = ids.select { |id| @props[id]["gameStatus"] == "live" }
      scheduled = ids.select { |id| @props[id]["gameStatus"] == "scheduled" }
      pool = live_ids.any? ? live_ids : scheduled
      return if pool.empty?

      updates = []
      n = 2 + rand(3)
      n.times do
        id = pool.sample
        prop = @props[id]
        next if prop.nil? || prop["gameStatus"] == "final"

        if prop["gameStatus"] == "scheduled" && rand < 0.04
          prop["gameStatus"] = "live"
          prop["clock"] = "Q1 12:00"
          prop["liveStat"] = 0
        end

        if prop["gameStatus"] == "live"
          if rand < 0.55
            prop["liveStat"] = bump_live_stat(prop)
          else
            prop["line"] = nudge_line(prop)
          end
          prop["clock"] = step_clock(prop["clock"])
          prop["gameStatus"] = "final" if prop["clock"] == "Final"
        elsif rand < 0.4
          prop["line"] = nudge_line(prop)
        end

        prop["updatedAt"] = Slate.now_ms
        tick = { "t" => prop["updatedAt"], "line" => prop["line"], "liveStat" => prop["liveStat"] }
        @history[id].push(tick)
        updates << { "id" => id, "prop" => prop.dup, "tick" => tick }
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

  def nudge_line(prop)
    delta = rand < 0.5 ? -0.5 : 0.5
    toward_open = (prop["openingLine"] <=> prop["line"]) * 0.5
    nxt = rand < 0.35 ? prop["line"] + toward_open : prop["line"] + delta
    min = [0.5, prop["openingLine"] - 3].max
    max = prop["openingLine"] + 3
    [[nxt, max].min, min].max
  end

  def bump_live_stat(prop)
    return prop["liveStat"] if prop["liveStat"].nil?

    step = if %w[pass_yds rush_yds].include?(prop["stat"])
             2 + rand(9)
           else
             rand < 0.55 ? 1 : 0
           end
    prop["liveStat"] + step
  end

  def step_clock(clock)
    m = clock.match(/\AQ(\d) (\d+):(\d+)\z/)
    return clock unless m

    q = m[1].to_i
    min = m[2].to_i
    sec = m[3].to_i - 9
    if sec.negative?
      sec += 60
      min -= 1
    end
    if min.negative?
      q += 1
      min = 11
      sec = 59
    end
    return "Final" if q > 4

    format("Q%d %d:%02d", q, min, sec)
  end
end
