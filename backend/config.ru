# This file is used by Rack-based servers to start the application.

require_relative "config/environment"

LiveEngine.instance.start! unless Rails.env.test?

run Rails.application
Rails.application.load_server
