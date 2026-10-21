import { test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { createRenderer, installNativeRuntime, nodes, text } from "../test/native";
installNativeRuntime();
const writes: any[] = [];
const alerts: any[] = [];
let persist: () => Promise<void> = async () => {};
mock.module("@/context/ScheduleContext", () => ({
  useSchedule: () => ({
    caregivers: [],
    addCaregiver: async (record: any) => {
      writes.push(record);
      await persist();
    },
  }),
}));
mock.module("@/context/AlertContext", () => ({
  useAlert: () => ({ showAlert: (alert: any) => alerts.push(alert) }),
}));
const { CreateScreen } = await import("./create");

function form() {
  writes.length = 0;
  alerts.length = 0;
  const renderer = createRenderer();
  const render = () => renderer.render(CreateScreen);
  let tree = render();
  for (const [placeholder, value] of [
    ["create.namePlaceholder", "Ana"],
    ["create.dayPlaceholder", "180"],
    ["create.nightPlaceholder", "220"],
  ]) {
    nodes(tree)
      .find((node) => node.props.placeholder === placeholder)!
      .props.onChangeText(value);
  }
  nodes(tree)
    .find((node) => node.type === "Pressable")!
    .props.onPress();
  tree = render();
  const submit = nodes(tree).find(
    (node) => node.type === "Pressable" && text(node).includes("create.save"),
  )!.props.onPress;
  return { renderer, render, submit };
}

test("two immediate caregiver submissions write once and expose busy state", async () => {
  let resolve!: () => void;
  persist = () =>
    new Promise<void>((done) => {
      resolve = done;
    });
  const { renderer, render, submit } = form();
  const first = submit();
  const second = submit();
  assert.equal(writes.length, 1);
  assert.ok(
    nodes(render()).some(
      (node) => node.props.accessibilityState?.busy === true && node.props.disabled,
    ),
  );
  resolve();
  await Promise.all([first, second]);
  assert.equal(alerts.filter((alert) => alert.title === "create.success").length, 1);
  assert.equal(
    nodes(render()).find((node) => node.props.placeholder === "create.namePlaceholder")!.props
      .value,
    "",
  );
  renderer.unmount();
});

test("a failed caregiver submission preserves entered values and enables retry", async () => {
  persist = async () => {
    throw new Error("offline");
  };
  const { renderer, render, submit } = form();
  await submit();
  const tree = render();
  assert.equal(
    nodes(tree).find((node) => node.props.placeholder === "create.namePlaceholder")!.props.value,
    "Ana",
  );
  const retry = nodes(tree).find(
    (node) => node.type === "Pressable" && text(node).includes("create.save"),
  )!;
  assert.equal(retry.props.disabled, false);
  persist = async () => {};
  await retry.props.onPress();
  assert.equal(writes.length, 2);
  assert.equal(alerts.at(-1).title, "create.success");
  renderer.unmount();
});
