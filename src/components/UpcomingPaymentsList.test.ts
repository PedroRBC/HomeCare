import { test } from "node:test";
import assert from "node:assert/strict";
import { createRenderer, installNativeRuntime, nodes, text } from "../test/native";
installNativeRuntime();
const { UpcomingPaymentsList } = await import("./UpcomingPaymentsList");
const item = {
  id: "one",
  caregiverId: "ana",
  caregiver: "Ana",
  frequency: "Diário",
  periodKey: "2026-10-21",
  amount: 10,
  description: "day",
  dayShifts: 1,
  nightShifts: 0,
} as any;

test("failed payment remains visible and retryable after processing", async () => {
  const renderer = createRenderer();
  let reject!: (error: Error) => void;
  const pending = new Promise<void>((_, fail) => {
    reject = fail;
  });
  const render = () =>
    renderer.render(() => UpcomingPaymentsList({ items: [item], onMarkPaid: () => pending }));
  const operation = nodes(render())
    .find((node) => node.type === "Pressable")!
    .props.onPress();
  assert.ok(text(render()).includes("common.processing"));
  reject(new Error("offline"));
  await operation;
  const tree = render();
  assert.ok(text(tree).includes("payments.markAsPaid"));
  assert.equal(nodes(tree).find((node) => node.type === "AnimatedView")!.props.style.opacity, 1);
  renderer.unmount();
});

test("completion timers are canceled when the payment list unmounts", async () => {
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  const pending = new Set<unknown>();
  globalThis.setTimeout = ((callback: unknown) => {
    pending.add(callback);
    return callback;
  }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = ((id: unknown) => {
    pending.delete(id);
  }) as typeof clearTimeout;
  try {
    const renderer = createRenderer();
    const tree = renderer.render(() =>
      UpcomingPaymentsList({ items: [item], onMarkPaid: async () => {} }),
    );
    await nodes(tree)
      .find((node) => node.type === "Pressable")!
      .props.onPress();
    assert.equal(pending.size, 1);
    renderer.unmount();
    assert.equal(pending.size, 0);
  } finally {
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
  }
});

test("successful payment alone enters completion state", async () => {
  const renderer = createRenderer();
  const render = () =>
    renderer.render(() => UpcomingPaymentsList({ items: [item], onMarkPaid: async () => {} }));
  await nodes(render())
    .find((node) => node.type === "Pressable")!
    .props.onPress();
  assert.equal(
    nodes(render()).find((node) => node.type === "AnimatedView")!.props.style.opacity,
    0,
  );
  renderer.unmount();
});
