# frozen_string_literal: true

require "rails_helper"

RSpec.describe RingBuffer do
  it "never grows past capacity and drops oldest first" do
    buf = described_class.new(3)
    buf.push(1).push(2).push(3).push(4).push(5)
    expect(buf.length).to eq(3)
    expect(buf.to_a).to eq([3, 4, 5])
  end
end
