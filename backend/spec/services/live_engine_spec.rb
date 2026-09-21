# frozen_string_literal: true

require "rails_helper"

RSpec.describe LiveEngine do
  let(:engine) { described_class.instance }

  before { engine.reset_slate! }

  it "caps tick history per prop at 48" do
    200.times { engine.tick! }
    history = engine.get_prop("nba-luka-pts")["history"]
    expect(history.length).to be <= 48
    expect(engine.snapshot["seq"]).to be > 0
  end

  it "gives every prop in a game the same clock" do
    50.times { engine.tick! }
    clocks = engine.snapshot["props"].select { |prop| prop["gameId"] == "nba-lal-bos" }.map { |prop| prop["clock"] }
    expect(clocks.length).to eq(3)
    expect(clocks.uniq.length).to eq(1)
  end

  it "keeps stats realistic for a whole slate of games" do
    # Long enough for every game to tip off and run out the clock.
    2_100.times do |i|
      engine.tick!
      next unless (i % 10).zero?

      engine.snapshot["props"].each do |prop|
        next if prop["liveStat"].nil?

        ceiling = Sim::STAT_PROFILES[prop["stat"]][:ceiling]
        expect(prop["liveStat"]).to be <= ceiling
        # The runaway bug this replaces had Durant at 58 threes on a 2.5 line.
        opening = prop["openingLine"]
        plausible = ((opening + Sim.line_bound(opening)) * Sim::MAX_PROJECTION_FACTOR) + 0.5
        expect(prop["liveStat"]).to be <= plausible
      end
    end
  end

  it "is not already decided three minutes in" do
    200.times { engine.tick! }
    live = engine.snapshot["props"].select { |prop| prop["gameStatus"] == "live" && prop["liveStat"] }
    over = live.select { |prop| prop["liveStat"] > prop["line"] }
    expect(live).not_to be_empty
    expect(over.length).to be <= live.length / 2.0
  end

  it "tips off scheduled games and freezes finished ones" do
    expect(engine.get_prop("nba-jokic-pts")["gameStatus"]).to eq("scheduled")
    150.times { engine.tick! }
    expect(engine.get_prop("nba-jokic-pts")["gameStatus"]).to eq("live")
    expect(engine.get_prop("nba-jokic-pts")["liveStat"]).not_to be_nil
    expect(engine.get_prop("nfl-jefferson-rec")["clock"]).to eq("Final")
  end

  it "reseeds the slate once every game is final" do
    2_100.times { engine.tick! }
    expect(engine.snapshot["props"].any? { |prop| prop["gameStatus"] != "final" }).to be(true)
  end
end
