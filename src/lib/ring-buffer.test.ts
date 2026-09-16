import assert from "node:assert/strict";
import { test } from "node:test";
import { RingBuffer } from "./ring-buffer";

test("never grows past capacity and drops oldest first", () => {
  const buf = new RingBuffer<number>(3);
  buf.push(1);
  buf.push(2);
  buf.push(3);
  buf.push(4);
  buf.push(5);
  assert.equal(buf.length, 3);
  assert.deepEqual(buf.toArray(), [3, 4, 5]);
});
