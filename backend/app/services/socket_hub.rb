# frozen_string_literal: true

# Fan-out for the raw /ws clients. The client cap lives on LiveEngine, which is
# the one place both transports read it from.
class SocketHub
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
