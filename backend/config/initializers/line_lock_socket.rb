# frozen_string_literal: true

require "websocket/driver"
require Rails.root.join("app/middleware/line_lock_socket").to_s

Rails.application.config.middleware.insert_before 0, LineLockSocket
