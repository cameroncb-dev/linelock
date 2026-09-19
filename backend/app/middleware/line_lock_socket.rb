# frozen_string_literal: true

require "websocket/driver"

class LineLockSocket
  def initialize(app)
    @app = app
  end

  def call(env)
    if websocket?(env) && env["PATH_INFO"] == "/ws"
      accept_socket(env)
    else
      @app.call(env)
    end
  end

  private

  def websocket?(env)
    env["HTTP_UPGRADE"].to_s.casecmp("websocket").zero?
  end

  def accept_socket(env)
    env["rack.hijack"].call
    io = env["rack.hijack_io"]
    socket = HijackedSocket.new(env, io)

    if SocketHub.size >= LiveEngine::MAX_CLIENTS
      socket.driver.close(1013, "capacity")
      return [-1, {}, []]
    end

    SocketHub.add(socket)
    socket.driver.on(:open) do
      hello = LiveEngine.instance.snapshot.merge("type" => "hello")
      socket.send_text(hello.to_json)
    end
    socket.driver.on(:close) { SocketHub.remove(socket) }
    socket.driver.start
    socket.listen
    [-1, {}, []]
  end

  class HijackedSocket
    attr_reader :env, :driver

    def initialize(env, io)
      @env = env
      @io = io
      @write_mutex = Mutex.new
      @url = "ws://#{env["HTTP_HOST"]}#{env["PATH_INFO"]}"
      @driver = WebSocket::Driver.rack(self)
    end

    def url
      @url
    end

    def write(data)
      @write_mutex.synchronize { @io.write(data) }
    end

    def send_text(payload)
      @driver.text(payload)
    end

    def listen
      Thread.new do
        loop { @driver.parse(@io.readpartial(4096)) }
      rescue EOFError, Errno::ECONNRESET, IOError
        SocketHub.remove(self)
      end
    end
  end
end
