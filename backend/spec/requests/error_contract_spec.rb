# frozen_string_literal: true

require "rails_helper"

# The headline claim of the project is "two backends, one contract". These cases
# live in contract/error-contract.json at the repo root and are replayed against
# the Node handler by src/server/api.test.ts, so the two cannot drift apart.
RSpec.describe "POST /api/entries error contract", type: :request do
  contract = JSON.parse(Rails.root.join("..", "contract", "error-contract.json").read)

  before { LiveEngine.instance.reset_slate! }

  contract["cases"].each do |example|
    it "answers #{example["name"]} with #{example["status"]}" do
      body = example["body"] || { legs: [], filler: "x" * example["bodyBytes"].to_i }.to_json

      post contract["path"], params: body, headers: { "CONTENT_TYPE" => "application/json" }

      expect(response.status).to eq(example["status"])
      expect(response.parsed_body).to eq({ "ok" => false, "error" => example["error"] })
    end
  end
end
