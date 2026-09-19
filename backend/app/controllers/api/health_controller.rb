# frozen_string_literal: true

module Api
  class HealthController < ApplicationController
    def show
      render json: LiveEngine.instance.health
    end
  end
end
