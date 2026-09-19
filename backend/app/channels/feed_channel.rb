# frozen_string_literal: true

class FeedChannel < ApplicationCable::Channel
  def subscribed
    stream_from LiveEngine::STREAM
    transmit(LiveEngine.instance.snapshot.merge("type" => "hello"))
  end
end
