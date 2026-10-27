import { mock } from "bun:test";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRenderer, installNativeRuntime } from "../test/native";

installNativeRuntime();
const writes: [string, string][] = [];
let finishRead: (value: string | null) => void = () => {};
let failRead: (error: Error) => void = () => {};
mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: () =>
      new Promise<string | null>((resolve, reject) => {
        finishRead = resolve;
        failRead = reject;
      }),
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

test("an unreadable stored value does not stop new colors from being saved", async () => {
  const renderer = createRenderer();
  const logged = console.error;
  console.error = () => {};
  const [, choose] = renderer.render(() => useChosenHouseColors("bia"));

  failRead(new SyntaxError("corrupt"));
  await Promise.resolve();
  await Promise.resolve();
  choose("a", "#444444");
  renderer.render(() => useChosenHouseColors("bia"));
  renderer.render(() => useChosenHouseColors("bia"));

  console.error = logged;
  assert.deepEqual(writes.at(-1), ["@homecare:houseColors.bia", JSON.stringify({ a: "#444444" })]);
  renderer.unmount();
});
