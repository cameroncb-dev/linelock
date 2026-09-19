# frozen_string_literal: true

require "rails_helper"

RSpec.describe FeedChannel, type: :channel do
  before { LiveEngine.instance.reset_slate! }

  it "transmits a hello snapshot on subscribe" do
    subscribe
    expect(subscription).to be_confirmed
    hello = transmissions.last
    expect(hello["type"]).to eq("hello")
    expect(hello["props"]).to be_an(Array)
    expect(hello["props"].length).to eq(16)
    expect(hello["memory"]["maxTicksPerProp"]).to eq(48)
  end

  it "subscribes to the live feed stream" do
    subscribe
    expect(subscription).to have_stream_from(LiveEngine::STREAM)
  end
end
