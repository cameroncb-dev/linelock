# frozen_string_literal: true

require "rails_helper"

RSpec.describe LiveEngine do
  before { described_class.instance.reset_slate! }

  it "caps tick history per prop at 48" do
    engine = described_class.instance
    50.times { engine.tick! }
    history = engine.get_prop("nba-luka-pts")["history"]
    expect(history.length).to be <= 48
    expect(engine.snapshot["seq"]).to be > 0
  end
end
