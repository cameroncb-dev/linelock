# frozen_string_literal: true

class SocketHub
  MAX_CLIENTS = 32

  @mutex = Mutex.new
  @clients = []

  class << self
    def add(socket)
      @mutex.synchronize do
        @clients << socket
        @clients.length
      end
    end

    def remove(socket)
      @mutex.synchronize { @clients.delete(socket) }
    end

    def size
      @mutex.synchronize { @clients.length }
    end

    def broadcast(payload)
      snapshot = @mutex.synchronize { @clients.dup }
      snapshot.each do |socket|
        socket.send_text(payload)
      rescue StandardError
        remove(socket)
      end
    end
  end
end
