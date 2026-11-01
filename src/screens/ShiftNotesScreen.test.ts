import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { createRenderer, installNativeRuntime, nodes, text, type Element } from "@/test/native";
import type { ShiftNote } from "@/utils/shiftNotes";
installNativeRuntime();
const jsx = (type: unknown, props: Record<string, unknown>, key?: string) => ({ type, props, key });
mock.module("react/jsx-runtime", () => ({ jsx, jsxs: jsx, Fragment: "Fragment" }));
mock.module("react/jsx-dev-runtime", () => ({ jsxDEV: jsx, Fragment: "Fragment" }));
const user = { uid: "cg", displayName: "Ana" };
let params = { houseId: "h1", date: "2026-10-31", shift: "night" };
let family = false;
let dualRole = false;
let alerts: any[];
let saves: any[];
let resolutions: any[];
let keyRequests: boolean[];
let saveError: Error | undefined;
let currentNotes: ShiftNote[];
let previousNotes: ShiftNote[];
let listeners: { next: (notes: ShiftNote[]) => void; fail: () => void; stopped: boolean }[];
class NoteConflictError extends Error {}
mock.module("@react-navigation/native", () => ({
  useRoute: () => ({ params }),
  useNavigation: () => ({ goBack: () => {} }),
}));
mock.module("@/context/AuthContext", () => ({ useAuth: () => ({ user }) }));
mock.module("@/context/HouseContext", () => ({
  useHouse: () => ({ userHouses: family ? [{ id: "h1" }] : [] }),
}));
mock.module("@/context/CaregiverContext", () => ({
  useCaregiver: () => ({
    acceptedLinks: family && !dualRole ? [] : [{ houseId: "h1", caregiverId: "c2" }],
  }),
}));
mock.module("@/context/AlertContext", () => ({
  useAlert: () => ({ showAlert: (alert: unknown) => alerts.push(alert) }),
}));
mock.module("@/i18n/format", () => ({ formatDate: () => "31/10/2026" }));
mock.module("expo-crypto", () => ({ randomUUID: () => "new-pending-item" }));
const schedule = { "2026-10-31": { day: ["c1"], night: ["c2"] } };
mock.module("@/services/shiftNotes", () => ({
  NoteConflictError,
  getNoteKey: async (_houseId: string, _uid: string, clinical = false) => {
    keyRequests.push(clinical);
    return new Uint8Array(32);
  },
  ShiftNotesService: {
    subscribeSchedule: (_houseId: string, update: (value: unknown) => void) => {
      update(schedule);
      return () => {};
    },
    subscribe: (
      _houseId: string,
      _shift: string,
      kind: string,
      _key: unknown,
      next: (notes: ShiftNote[]) => void,
      fail: () => void,
    ) => {
      const listener = { next, fail, stopped: false };
      listeners.push(listener);
      next(currentNotes.filter((note) => note.payload.kind === kind));
      return () => {
        listener.stopped = true;
      };
    },
    subscribePrevious: (
      _houseId: string,
      _id: string,
      _current: string,
      _previous: string,
      _key: unknown,
      next: (notes: ShiftNote[]) => void,
    ) => {
      next(previousNotes);
      return () => {};
    },
    save: async (...args: unknown[]) => {
      saves.push(args);
      if (saveError) throw saveError;
    },
    resolve: async (...args: unknown[]) => {
      resolutions.push(args);
    },
    remove: async () => {},
  },
}));
const { ShiftNotesScreen } = await import("./ShiftNotesScreen");
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
async function mount() {
  const renderer = createRenderer();
  const screen = ShiftNotesScreen() as unknown as Element;
  const render = () =>
    renderer.render(() => (screen.type as (props: any) => unknown)(screen.props));
  render();
  await settle();
  render();
  await settle();
  render();
  return { renderer, render };
}
const press = async (tree: unknown, label: string) => {
  const button = nodes(tree).find((node) => node.type === "Pressable" && text(node) === label);
  assert.ok(button, `Missing ${label}`);
  assert.ok(!button.props.disabled, `${label} disabled`);
  await button.props.onPress();
};
beforeEach(() => {
  family = false;
  dualRole = false;
  alerts = [];
  saves = [];
  resolutions = [];
  keyRequests = [];
  currentNotes = [];
  previousNotes = [];
  listeners = [];
  saveError = undefined;
  params = { houseId: "h1", date: "2026-10-31", shift: "night" };
});

test("family loads only the communication key and cannot see clinical editor or previous handovers", async () => {
  family = true;
  const { render, renderer } = await mount();
  assert.deepEqual(keyRequests, [false]);
  assert.ok(!text(render()).includes("shiftNotes.previous"));
  assert.ok(
    !nodes(render()).some(
      (node) => node.type === "Pressable" && text(node) === "shiftNotes.handover",
    ),
  );
  assert.ok(text(render()).includes("shiftNotes.messageLabel"));
  renderer.unmount();
});

test("a manager who is also a caregiver can moderate messages but not another caregiver's clinical note", async () => {
  family = true;
  dualRole = true;
  const common = {
    shiftKey: "2026-10-31:night",
    authorUid: "other",
    revision: 1,
    createdAt: "",
    pendingStatus: {},
  };
  currentNotes = [
    {
      ...common,
      id: "clinical",
      caregiverId: "c1",
      payload: {
        kind: "handover",
        medication: true,
        meals: false,
        activities: false,
        pending: [],
        observations: "Clinical text",
      },
    },
    {
      ...common,
      id: "message",
      caregiverId: null,
      payload: { kind: "message", text: "Family message" },
    },
  ];
  const { render, renderer } = await mount();
  assert.ok(text(render()).includes("Clinical text"));
  assert.equal(
    nodes(render()).filter(
      (node) => node.type === "Pressable" && text(node) === "shiftNotes.delete",
    ).length,
    1,
  );
  renderer.unmount();
});

test("failed save preserves the draft and permits retry; blank messages are rejected", async () => {
  const { render, renderer } = await mount();
  await press(render(), "shiftNotes.save");
  assert.equal(saves.length, 0);
  assert.equal(alerts.at(-1).message, "shiftNotes.invalid");
  nodes(render())
    .find((node) => node.type === "TextInput")!
    .props.onChangeText("Consulta às 9h");
  saveError = new Error("offline");
  await press(render(), "shiftNotes.save");
  assert.equal(
    nodes(render()).find((node) => node.type === "TextInput")!.props.value,
    "Consulta às 9h",
  );
  assert.equal(alerts.at(-1).message, "shiftNotes.saveError");
  saveError = undefined;
  await press(render(), "shiftNotes.save");
  assert.equal(nodes(render()).find((node) => node.type === "TextInput")!.props.value, "");
  assert.equal(saves.length, 2);
  renderer.unmount();
});

test("next caregiver sees structured pending tasks and can resolve them without editing the source text", async () => {
  previousNotes = [
    {
      id: "prior",
      shiftKey: "2026-10-31:day",
      authorUid: "previous",
      caregiverId: "c1",
      revision: 1,
      createdAt: "",
      pendingStatus: { p1: "open" },
      payload: {
        kind: "handover",
        medication: true,
        meals: true,
        activities: false,
        observations: "",
        pending: [{ id: "p1", text: "Verificar pressão" }],
      },
    },
  ];
  const { render, renderer } = await mount();
  assert.ok(text(render()).includes("shiftNotes.previous"));
  const task = nodes(render()).find(
    (node) => node.props.accessibilityLabel === "Verificar pressão",
  );
  assert.ok(task);
  assert.equal(task.props.disabled, false);
  assert.equal(task.props.accessibilityState.checked, false);
  await task.props.onPress();
  assert.equal(resolutions.length, 1);
  assert.deepEqual(resolutions[0].slice(3), ["p1", "done"]);
  renderer.unmount();
});

test("listener failure hides loaded notes and stale callbacks cannot restore them", async () => {
  currentNotes = [
    {
      id: "message",
      shiftKey: "2026-10-31:night",
      authorUid: "other",
      caregiverId: null,
      revision: 1,
      createdAt: "",
      pendingStatus: {},
      payload: { kind: "message", text: "Private message" },
    },
  ];
  const { render, renderer } = await mount();
  assert.ok(text(render()).includes("Private message"));
  listeners[0].fail();
  assert.ok(text(render()).includes("shiftNotes.loadError"));
  listeners[0].next(currentNotes);
  assert.ok(!text(render()).includes("Private message"));
  renderer.unmount();
  assert.ok(listeners.every((listener) => listener.stopped));
});

test("a different house or shift uses a new component key, never the previous context's draft", () => {
  const first = ShiftNotesScreen() as unknown as Element;
  params = { ...params, houseId: "h2" };
  const second = ShiftNotesScreen() as unknown as Element;
  assert.notEqual(
    (first as Element & { key: string }).key,
    (second as Element & { key: string }).key,
  );
});
