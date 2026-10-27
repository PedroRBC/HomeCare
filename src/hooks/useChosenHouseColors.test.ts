import { mock } from "bun:test";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRenderer, installNativeRuntime } from "../test/native";

installNativeRuntime();
const writes: [string, string][] = [];
let finishRead: (value: string | null) => void = () => {};
mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: () => new Promise<string | null>((resolve) => (finishRead = resolve)),
    setItem: async (key: string, value: string) => {
      writes.push([key, value]);
    },
  },
}));
const { useChosenHouseColors } = await import("./useChosenHouseColors");

test("a color chosen while saved colors load keeps the other saved houses", async () => {
  const renderer = createRenderer();
  const [, choose] = renderer.render(() => useChosenHouseColors("ana"));

  choose("b", "#111111");
  renderer.render(() => useChosenHouseColors("ana"));
  assert.deepEqual(writes, []);

  finishRead(JSON.stringify({ a: "#222222", b: "#333333" }));
  await Promise.resolve();
  renderer.render(() => useChosenHouseColors("ana"));
  const [chosen] = renderer.render(() => useChosenHouseColors("ana"));

  assert.deepEqual(chosen, { a: "#222222", b: "#111111" });
  assert.deepEqual(JSON.parse(writes.at(-1)![1]), { a: "#222222", b: "#111111" });
  assert.equal(writes.at(-1)![0], "@homecare:houseColors.ana");
  renderer.unmount();
});
