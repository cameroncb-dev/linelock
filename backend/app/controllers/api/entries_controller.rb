# frozen_string_literal: true

module Api
  class EntriesController < ApplicationController
    MAX_BODY_BYTES = 8_192

    def index
      render json: { entries: LiveEngine.instance.list_entries }
    end

    def create
      if request.content_length.to_i > MAX_BODY_BYTES
        return render_error(:content_too_large, "Body must be under #{MAX_BODY_BYTES} bytes.")
      end

      body = parsed_body
      return render_error(:bad_request, INVALID_JSON_ERROR) if body == :invalid

      result = LiveEngine.instance.submit_entry(legs_in(body))
      if result[:ok]
        render json: result, status: :created
      else
        render json: result.except(:status), status: result[:status]
      end
    end

    private

    def parsed_body
      raw = request.raw_post
      return {} if raw.blank?

      JSON.parse(raw)
    rescue JSON::ParserError
      :invalid
    end

    def legs_in(body)
      return [] unless body.is_a?(Hash) && body["legs"].is_a?(Array)

      body["legs"]
    end
  end
end
