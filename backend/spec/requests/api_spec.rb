# frozen_string_literal: true

require "rails_helper"

RSpec.describe "LineLock API", type: :request do
  before { LiveEngine.instance.reset_slate! }

  describe "GET /api/health" do
    it "reports the Rails backend and memory cap" do
      get "/api/health"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["product"]).to eq("LineLock")
      expect(json["backend"]).to eq("rails")
      expect(json["memory"]["maxTicksPerProp"]).to eq(48)
    end
  end

  describe "GET /api/props" do
    it "returns the slate with bounded history" do
      get "/api/props"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["props"].length).to eq(16)
      luka = json["props"].find { |prop| prop["id"] == "nba-luka-pts" }
      expect(luka["player"]).to eq("Luka Dončić")
      expect(luka["history"].length).to be_between(1, 48)
    end
  end

  describe "GET /api/props/:id" do
    it "returns one prop" do
      get "/api/props/nba-luka-pts"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["id"]).to eq("nba-luka-pts")
    end

    it "404s unknown ids" do
      get "/api/props/nope"
      expect(response).to have_http_status(:not_found)
      expect(response.parsed_body).to eq({ "ok" => false, "error" => "Prop not found." })
    end
  end

  describe "POST /api/entries" do
    def current_line(id)
      LiveEngine.instance.get_prop(id)["line"]
    end

    it "locks a 2-pick slip" do
      post "/api/entries",
           params: {
             legs: [
               { propId: "nba-jokic-pts", side: "more", lockedLine: current_line("nba-jokic-pts") },
               { propId: "nba-edwards-pts", side: "less", lockedLine: current_line("nba-edwards-pts") }
             ]
           },
           as: :json

      expect(response).to have_http_status(:created)
      json = response.parsed_body
      expect(json["ok"]).to eq(true)
      expect(json["entry"]["multiplier"]).to eq(3)
    end

    it "rejects a short slip" do
      post "/api/entries",
           params: { legs: [ { propId: "nba-jokic-pts", side: "more", lockedLine: 27.5 } ] },
           as: :json
      expect(response).to have_http_status(:bad_request)
    end

    it "rejects drifted lines" do
      post "/api/entries",
           params: {
             legs: [
               { propId: "nba-jokic-pts", side: "more", lockedLine: current_line("nba-jokic-pts") },
               { propId: "nba-edwards-pts", side: "less", lockedLine: 0.5 }
             ]
           },
           as: :json
      expect(response).to have_http_status(:conflict)
      expect(response.parsed_body["drifted"]).to include("nba-edwards-pts")
      expect(response.parsed_body).not_to have_key("status")
    end
  end
end
