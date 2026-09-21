# frozen_string_literal: true

class ApplicationController < ActionController::API
  INVALID_JSON_ERROR = "Body must be valid JSON."

  # Matches the Node server: a malformed body is a 400 with the same JSON shape,
  # never a 500 with a stack trace in it.
  rescue_from ActionDispatch::Http::Parameters::ParseError do
    render_error(:bad_request, INVALID_JSON_ERROR)
  end

  private

  def render_error(status, message)
    render json: { ok: false, error: message }, status: status
  end
end
