import { test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { createRenderer, installNativeRuntime } from "../test/native";

installNativeRuntime();
Object.assign(globalThis, { __DEV__: false });
let houseId = "house-a";
const listeners: {
  receive: (value: any) => void;
  fail: (error: Error) => void;
  stopped: boolean;
}[] = [];
const subscribe = (receive: (value: any) => void, fail: (error: Error) => void) => {
  const listener = { receive, fail, stopped: false };
  listeners.push(listener);
  return () => {
    listener.stopped = true;
  };
};
mock.module("./AuthContext", () => ({ useAuth: () => ({ user: { uid: "owner" } }) }));
mock.module("./HouseContext", () => ({
  useHouse: () => ({ currentHouse: { id: houseId, name: houseId } }),
}));
mock.module("@/services/firebase", () => ({ AnalyticsService: {} }));
mock.module("@/services/firestore", () => ({
  FirestoreService: {
    initialize: async () => true,
    cleanup: () => {},
    subscribeToCaregivers: subscribe,
    subscribeToSchedule: subscribe,
    subscribeToPayments: subscribe,
    subscribeToPaymentHistory: subscribe,
  },
}));
const { ScheduleProvider } = await import("./ScheduleContext");
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function mount() {
  listeners.length = 0;
  houseId = "house-a";
  const renderer = createRenderer();
  const read = () =>
    (renderer.render(() => ScheduleProvider({ children: null })) as any).props.value;
  read();
  return { renderer, read };
}

test("a failed initial listener exposes an error rather than a ready empty house", async () => {
  const { renderer, read } = mount();
  await settle();
  listeners[0].fail(new Error("denied"));
  const state = read();
  assert.equal(state.hasLoadError, true);
  assert.equal(state.isLoading, false);
  assert.equal(state.isFirestoreConnected, false);
  renderer.unmount();
});

test("four successful empty snapshots are ready and are not a load error", async () => {
  const { renderer, read } = mount();
  await settle();
  [[], {}, { daily: {}, weekly: {}, monthly: {} }, []].forEach((data, i) =>
    listeners[i].receive(data),
  );
  assert.equal(read().isFirestoreConnected, true);
  assert.equal(read().hasLoadError, false);
  renderer.unmount();
});

test("retry replaces subscriptions and stale-house failures cannot poison the current load", async () => {
  const { renderer, read } = mount();
  await settle();
  const old = listeners.slice();
  old[0].fail(new Error("offline"));
  read().retryLoad();
  read();
  await settle();
  assert.ok(old.every((listener) => listener.stopped));
  assert.equal(listeners.length, 8);
  assert.equal(read().hasLoadError, false);
  assert.equal(read().isLoading, true);
  houseId = "house-b";
  read();
  await settle();
  old[0].fail(new Error("late failure"));
  old[0].receive([{ id: "old", name: "Old house" }]);
  const current = read();
  assert.equal(current.hasLoadError, false);
  assert.deepEqual(current.caregivers, []);
  renderer.unmount();
});
