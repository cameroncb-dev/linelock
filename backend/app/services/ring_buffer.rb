# frozen_string_literal: true

class RingBuffer
  attr_reader :capacity, :length

  def initialize(capacity)
    raise ArgumentError, "capacity must be >= 1" if capacity < 1

    @capacity = capacity
    @buf = Array.new(capacity)
    @head = 0
    @length = 0
  end

  def push(item)
    i = (@head + @length) % @capacity
    @buf[i] = item
    if @length < @capacity
      @length += 1
    else
      @head = (@head + 1) % @capacity
    end
    self
  end

  def to_a
    Array.new(@length) { |i| @buf[(@head + i) % @capacity] }
  end
end
