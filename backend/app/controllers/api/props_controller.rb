# frozen_string_literal: true

module Api
  class PropsController < ApplicationController
    def index
      render json: LiveEngine.instance.snapshot
    end

    def show
      prop = LiveEngine.instance.get_prop(params[:id])
      if prop
        render json: prop
      else
        render json: { error: "Prop not found" }, status: :not_found
      end
    end
  end
end
