# frozen_string_literal: true

require "rails_helper"

RSpec.describe Sim do
  describe ".format_clock" do
    it "counts down inside the quarter it is in" do
      expect(described_class.format_clock("NBA", described_class.elapsed_at("NBA", 2, 4, 18))).to eq("Q2 4:18")
      expect(described_class.format_clock("NFL", described_class.elapsed_at("NFL", 3, 8, 51))).to eq("Q3 8:51")
      expect(described_class.format_clock("NBA", 0)).to eq("Q1 12:00")
      expect(described_class.format_clock("NBA", described_class.regulation_seconds("NBA"))).to eq("Final")
    end
  end

  describe ".project_final" do
    it "stays within a plausible band around the line" do
      2_000.times do
        projected = described_class.project_final(28.5, "points")
        expect(projected).to be >= (28.5 * described_class::MIN_PROJECTION_FACTOR) - 1
        expect(projected).to be <= (28.5 * described_class::MAX_PROJECTION_FACTOR) + 1
      end
    end

    it "never exceeds the best single game on record" do
      described_class::STAT_PROFILES.each do |stat, profile|
        expect(described_class.project_final(profile[:ceiling] * 10, stat)).to be <= profile[:ceiling]
      end
    end
  end

  describe ".advance_stat" do
    it "cannot outrun the game clock" do
      # Kevin Durant, 2.5 threes: the bug this replaces had him at 58 by minute 15.
      projected = described_class.project_final(2.5, "threes")
      live = 0
      total = described_class.regulation_seconds("NBA")
      0.step(total, described_class::GAME_SECONDS_PER_TICK) do |elapsed|
        progress = described_class.game_progress("NBA", elapsed)
        live = described_class.advance_stat(live, projected, "threes", progress)
        expect(live).to be <= projected
        expect(live).to be <= described_class::STAT_PROFILES["threes"][:ceiling]
      end
      expect(live).to eq(projected)
    end

    it "is still short of the line at halftime" do
      line = 268.5
      projected = described_class.project_final(line, "pass_yds")
      live = 0
      total = described_class.regulation_seconds("NFL")
      0.step(total / 2, described_class::GAME_SECONDS_PER_TICK) do |elapsed|
        live = described_class.advance_stat(live, projected, "pass_yds", described_class.game_progress("NFL", elapsed))
      end
      expect((live / line) * 100).to be < 85
    end
  end

  describe ".nudge_line" do
    it "keeps small lines from collapsing" do
      line = 2.5
      500.times { line = described_class.nudge_line(line, 2.5) }
      expect(line).to be_between(1.5, 3.5)
    end
  end
end
