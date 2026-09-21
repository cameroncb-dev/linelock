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
        render_error(:not_found, "Prop not found.")
      end
    end
  end
end
