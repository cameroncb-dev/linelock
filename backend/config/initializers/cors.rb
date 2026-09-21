# frozen_string_literal: true

# The board runs on a different origin than this API, so it needs CORS. Default
# to the two local origins the README tells you to use rather than "*"; set
# ALLOWED_ORIGINS (comma separated) to serve the board from anywhere else.
ALLOWED_ORIGINS = ENV.fetch(
  "ALLOWED_ORIGINS",
  "http://127.0.0.1:43147,http://localhost:43147"
).split(",").map(&:strip)

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*ALLOWED_ORIGINS)
    resource "*",
             headers: :any,
             methods: %i[get post options head]
  end
end
