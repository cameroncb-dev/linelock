require_relative "boot"

require "rails"
# LineLock keeps its whole state in process, so it loads only the frameworks it
# uses: controllers for the JSON API and Action Cable for the live feed. There
# is no database, no Active Storage, no mailer.
require "action_controller/railtie"
require "action_cable/engine"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module LineLock
  class Application < Rails::Application
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    config.autoload_lib(ignore: %w[assets tasks])

    # Only loads a smaller set of middleware suitable for API only apps.
    config.api_only = true
  end
end
