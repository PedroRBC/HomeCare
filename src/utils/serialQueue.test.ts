import { test } from "node:test";
import assert from "node:assert/strict";
import { createSerialQueue } from "./serialQueue";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("tasks finish in the order they were queued, even when an earlier one is slower", async () => {
  const enqueue = createSerialQueue();
  const applied: string[] = [];
  // e.g. "turn telemetry on" is slow and "turn it off" is fast: off must be last
  const on = enqueue(async () => {
    await sleep(30);
    applied.push("on");
  });
  const off = enqueue(async () => {
    applied.push("off");
  });
  await Promise.all([on, off]);
  assert.deepEqual(applied, ["on", "off"]);
});

test("a failed task reports its error and doesn't block the next one", async () => {
  const enqueue = createSerialQueue();
  const failed = enqueue(async () => {
    throw new Error("device refused");
  });
  const next = enqueue(async () => "applied");
  await assert.rejects(failed, /device refused/);
  assert.equal(await next, "applied");
});
