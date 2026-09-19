# frozen_string_literal: true

module Api
  class EntriesController < ApplicationController
    def index
      render json: { entries: LiveEngine.instance.list_entries }
    end

    def create
      legs = entry_legs
      result = LiveEngine.instance.submit_entry(legs)
      if result[:ok]
        render json: result, status: :created
      else
        body = result.except(:status)
        render json: body, status: result[:status]
      end
    end

    private

    def entry_legs
      body = JSON.parse(request.raw_post.presence || "{}")
      Array(body["legs"]).map do |leg|
        {
          "propId" => leg["propId"],
          "side" => leg["side"],
          "lockedLine" => leg["lockedLine"].to_f
        }
      end
    end
  end
end
