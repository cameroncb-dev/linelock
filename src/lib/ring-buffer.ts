/** Fixed-capacity ring buffer. Oldest values are dropped; length never exceeds capacity. */
export class RingBuffer<T> {
  private readonly buf: Array<T | undefined>;
  private head = 0;
  private length_ = 0;

  constructor(readonly capacity: number) {
    if (capacity < 1) throw new Error("capacity must be >= 1");
    this.buf = new Array(capacity);
  }

  get length(): number {
    return this.length_;
  }

  push(item: T): void {
    const i = (this.head + this.length_) % this.capacity;
    this.buf[i] = item;
    if (this.length_ < this.capacity) {
      this.length_ += 1;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  toArray(): T[] {
    const out: T[] = [];
    for (let i = 0; i < this.length_; i++) {
      out.push(this.buf[(this.head + i) % this.capacity] as T);
    }
    return out;
  }
}
