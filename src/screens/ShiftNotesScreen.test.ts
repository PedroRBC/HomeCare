import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { createRenderer, installNativeRuntime, nodes, text, type Element } from "@/test/native";
import { importDataKey } from "@/utils/fieldCrypto";
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
let unreadableMessages = 0;
let waitingHandovers = false;
let waitingPrevious = false;
let unreadableHandovers = 0;
let unreadablePrevious = 0;
let previousListener:
  | {
      next: (notes: ShiftNote[], unreadable?: number, confirmed?: boolean) => void;
      fail: () => void;
    }
  | undefined;
let failedKey: boolean | undefined;
let waitingKey: boolean | undefined;
let scheduleReady = true;
let scheduleIsConfirmed = true;
let firstLinkDisabled = false;
let scheduleAccesses: string[];
let scheduleUpdate: (value: unknown, confirmed?: boolean) => void;
let currentNotes: ShiftNote[];
let previousNotes: ShiftNote[];
let listeners: {
  kind: string;
  next: (notes: ShiftNote[], unreadable?: number, confirmed?: boolean) => void;
  fail: () => void;
  stopped: boolean;
}[];
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
    acceptedLinks:
      family && !dualRole
        ? []
        : [
            { id: "h1__c1", houseId: "h1", caregiverId: "c1", disabled: firstLinkDisabled },
            { id: "h1__c2", houseId: "h1", caregiverId: "c2" },
          ],
  }),
}));
mock.module("@/context/AlertContext", () => ({
  useAlert: () => ({ showAlert: (alert: unknown) => alerts.push(alert) }),
}));
mock.module("@/i18n/format", () => ({ formatDate: () => "31/10/2026" }));
mock.module("expo-crypto", () => ({ randomUUID: () => "new-pending-item" }));
let schedule = { "2026-10-31": { day: ["c1"], night: ["c2"] } };
mock.module("@/services/firestore", () => ({
  FirestoreService: {
    subscribeToHouseSchedule: (
      _houseId: string,
      access: { linkId: string },
      update: (value: unknown, confirmed?: boolean) => void,
    ) => {
      scheduleAccesses.push(access.linkId);
      scheduleUpdate = update;
      if (scheduleReady) update(schedule, scheduleIsConfirmed);
      return () => {};
    },
  },
}));
mock.module("@/services/shiftNotes", () => ({
  NoteConflictError,
  getNoteKey: async (_houseId: string, _uid: string, clinical = false) => {
    keyRequests.push(clinical);
    if (clinical === failedKey) return importDataKey("a".repeat(44));
    if (clinical === waitingKey) return new Promise<Uint8Array>(() => {});
    return new Uint8Array(32);
  },
  ShiftNotesService: {
    subscribeSchedule: (
      _houseId: string,
      update: (value: unknown, confirmed?: boolean) => void,
    ) => {
      scheduleUpdate = update;
      update(schedule, scheduleIsConfirmed);
      return () => {};
    },
    subscribe: (
      _houseId: string,
      _shift: string,
      kind: string,
      _key: unknown,
      next: (notes: ShiftNote[], unreadable?: number, confirmed?: boolean) => void,
      fail: () => void,
    ) => {
      const listener = { kind, next, fail, stopped: false };
      listeners.push(listener);
      if (kind !== "handover" || !waitingHandovers)
        next(
          currentNotes.filter((note) => note.payload.kind === kind),
          kind === "message" ? unreadableMessages : unreadableHandovers,
          true,
        );
      return () => {
        listener.stopped = true;
      };
    },
    subscribePrevious: (
      _houseId: string,
      _current: string,
      _previous: string,
      _key: unknown,
      next: (notes: ShiftNote[], unreadable?: number, confirmed?: boolean) => void,
      fail: () => void,
    ) => {
      previousListener = { next, fail };
      if (!waitingPrevious)
        next(
          previousNotes.filter((note) => !_previous || note.shiftKey >= _previous),
          unreadablePrevious,
          true,
        );
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
  unreadableMessages = 0;
  waitingHandovers = false;
  waitingPrevious = false;
  unreadableHandovers = 0;
  unreadablePrevious = 0;
  previousListener = undefined;
  scheduleReady = true;
  scheduleIsConfirmed = true;
  firstLinkDisabled = false;
  scheduleAccesses = [];
  failedKey = undefined;
  waitingKey = undefined;
  schedule = { "2026-10-31": { day: ["c1"], night: ["c2"] } };
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
    generation: "g1",
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
  unreadableMessages = 0;
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
      generation: "g1",
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
  assert.deepEqual(resolutions[0].slice(3), ["p1", "done", "h1__c2"]);
  renderer.unmount();
});

const clinicalNote = (): ShiftNote => ({
  id: "clinical",
  shiftKey: "2026-10-31:night",
  authorUid: "other",
  caregiverId: "c1",
  revision: 1,
  generation: "g1",
  createdAt: "",
  pendingStatus: { p1: "open" },
  payload: {
    kind: "handover",
    medication: true,
    meals: false,
    activities: false,
    observations: "Clinical survives",
    pending: [{ id: "p1", text: "Pending care" }],
  },
});

test("unreadable messages show an explicit warning without hiding valid handovers or actionable pending tasks", async () => {
  unreadableMessages = 1;
  previousNotes = [{ ...clinicalNote(), shiftKey: "2026-10-31:day" }];
  const { render, renderer } = await mount();
  assert.ok(text(render()).includes("shiftNotes.unreadableNotes"));
  assert.ok(text(render()).includes("Clinical survives"));
  const task = nodes(render()).find((node) => node.props.accessibilityLabel === "Pending care");
  assert.ok(task);
  assert.equal(task.props.disabled, false);
  await task.props.onPress();
  assert.equal(resolutions.length, 1);
  renderer.unmount();
});

test("handover creation uses the assigned link even when another accepted link appears first", async () => {
  const { render, renderer } = await mount();
  await press(render(), "shiftNotes.handover");
  nodes(render())
    .find((node) => node.props.accessibilityLabel === "shiftNotes.medication")!
    .props.onPress();
  await press(render(), "shiftNotes.save");
  assert.equal(saves.length, 1);
  assert.equal(saves[0][4], "h1__c2");
  renderer.unmount();
});

test("a section failure hides only that section, and stale callbacks cannot restore it", async () => {
  currentNotes = [
    {
      id: "message",
      shiftKey: "2026-10-31:night",
      authorUid: "other",
      caregiverId: null,
      revision: 1,
      generation: "g1",
      createdAt: "",
      pendingStatus: {},
      payload: { kind: "message", text: "Private message" },
    },
  ];
  currentNotes.push(clinicalNote());
  const { render, renderer } = await mount();
  assert.ok(text(render()).includes("Private message"));
  listeners[0].fail();
  assert.ok(text(render()).includes("shiftNotes.sectionUnavailable"));
  listeners[0].next(currentNotes, 0, true);
  assert.ok(!text(render()).includes("Private message"));
  assert.ok(text(render()).includes("Clinical survives"));
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

for (const waiting of [false, true]) {
  test(`a ${waiting ? "pending" : "malformed"} message key leaves clinical notes and task resolution available`, async () => {
    if (waiting) waitingKey = false;
    else failedKey = false;
    previousNotes = [{ ...clinicalNote(), shiftKey: "2026-10-31:day" }];
    const { render, renderer } = await mount();
    assert.ok(text(render()).includes("Clinical survives"));
    if (!waiting) assert.ok(text(render()).includes("shiftNotes.sectionUnavailable"));
    const task = nodes(render()).find((node) => node.props.accessibilityLabel === "Pending care");
    assert.ok(task && !task.props.disabled);
    await task.props.onPress();
    assert.equal(resolutions.length, 1);
    await press(render(), "shiftNotes.handover");
    nodes(render())
      .find((node) => node.props.accessibilityLabel === "shiftNotes.medication")!
      .props.onPress();
    await press(render(), "shiftNotes.save");
    assert.equal(saves.length, 1);
    assert.equal(saves[0][3].kind, "handover");
    renderer.unmount();
  });
}

test("a failed clinical key leaves messages visible and writable", async () => {
  failedKey = true;
  currentNotes = [
    { ...clinicalNote(), caregiverId: null, payload: { kind: "message", text: "Consulta" } },
  ];
  const { render, renderer } = await mount();
  assert.ok(text(render()).includes("Consulta"));
  assert.ok(text(render()).includes("shiftNotes.sectionUnavailable"));
  nodes(render())
    .find((node) => node.type === "TextInput")!
    .props.onChangeText("Confirmado");
  await press(render(), "shiftNotes.save");
  assert.equal(saves.length, 1);
  renderer.unmount();
});

test("removing the last assignment in the prior shift preserves its recorded handover and actionable task", async () => {
  previousNotes = [{ ...clinicalNote(), shiftKey: "2026-10-31:day" }];
  const { render, renderer } = await mount();
  assert.ok(text(render()).includes("Clinical survives"));
  schedule = { "2026-10-31": { day: [], night: ["c2"] } };
  scheduleUpdate(schedule, true);
  render();
  await settle();
  render();
  assert.ok(text(render()).includes("Clinical survives"));
  const task = nodes(render()).find((node) => node.props.accessibilityLabel === "Pending care");
  assert.ok(task && !task.props.disabled);
  await task.props.onPress();
  assert.deepEqual(resolutions[0].slice(3), ["p1", "done", "h1__c2"]);
  renderer.unmount();
});

test("key initialization waits for schedule access prepared with an active link", async () => {
  firstLinkDisabled = true;
  scheduleReady = false;
  const { render, renderer } = await mount();
  assert.deepEqual(scheduleAccesses, ["h1__c2"]);
  assert.deepEqual(keyRequests, []);
  scheduleUpdate(schedule, true);
  render();
  await settle();
  render();
  assert.deepEqual(keyRequests, [false, true]);
  assert.ok(text(render()).includes("shiftNotes.messageLabel"));
  renderer.unmount();
});

test("retry waits for renewed access instead of reusing the previous schedule to request keys", async () => {
  failedKey = false;
  const { render, renderer } = await mount();
  assert.deepEqual(keyRequests, [false, true]);
  scheduleReady = false;
  failedKey = undefined;
  await press(render(), "shiftNotes.retry");
  render();
  await settle();
  render();
  assert.deepEqual(keyRequests, [false, true]);
  scheduleUpdate(schedule, true);
  render();
  await settle();
  render();
  assert.deepEqual(keyRequests, [false, true, false, true]);
  assert.ok(!text(render()).includes("shiftNotes.sectionUnavailable"));
  renderer.unmount();
});

const buttonNamed = (tree: unknown, label: string) => {
  const button = nodes(tree).find((node) => node.type === "Pressable" && text(node) === label);
  assert.ok(button, `Missing ${label}`);
  return button;
};

test("current handovers must load before choosing create/edit, while messages and prior tasks remain usable", async () => {
  waitingHandovers = true;
  const own = { ...clinicalNote(), authorUid: user.uid, caregiverId: "c2" };
  currentNotes = [own];
  previousNotes = [{ ...clinicalNote(), shiftKey: "2026-10-31:day" }];
  const { render, renderer } = await mount();
  assert.equal(buttonNamed(render(), "shiftNotes.handover").props.disabled, true);
  nodes(render())
    .find((node) => node.type === "TextInput")!
    .props.onChangeText("Recado independente");
  await press(render(), "shiftNotes.save");
  assert.equal(saves[0][3].kind, "message");
  const task = nodes(render()).find((node) => node.props.accessibilityLabel === "Pending care");
  assert.ok(task && !task.props.disabled);
  await task.props.onPress();
  assert.equal(resolutions.length, 1);
  listeners.find((listener) => listener.kind === "handover")!.next([own], 0, true);
  await press(render(), "shiftNotes.handover");
  assert.ok(text(render()).includes("shiftNotes.editing"));
  nodes(render())
    .find((node) => node.props.accessibilityLabel === "shiftNotes.observations")!
    .props.onChangeText("Rascunho preservado");
  await press(render(), "shiftNotes.save");
  assert.equal(saves[1][5], own);
  assert.equal(saves[1][3].observations, "Rascunho preservado");
  renderer.unmount();
});

for (const unavailable of ["failed", "unreadable"]) {
  test(`a ${unavailable} current handover section cannot save an open clinical draft`, async () => {
    const own = { ...clinicalNote(), authorUid: user.uid, caregiverId: "c2" };
    currentNotes = [own];
    const { render, renderer } = await mount();
    await press(render(), "shiftNotes.handover");
    nodes(render())
      .find((node) => node.props.accessibilityLabel === "shiftNotes.observations")!
      .props.onChangeText("Keep draft");
    const listener = listeners.find((listener) => listener.kind === "handover")!;
    if (unavailable === "failed") listener.fail();
    else {
      listener.next([], 1, true);
    }
    const save = buttonNamed(render(), "shiftNotes.save");
    assert.equal(save.props.disabled, true);
    await save.props.onPress();
    assert.equal(saves.length, 0);
    assert.equal(
      nodes(render()).find((node) => node.props.accessibilityLabel === "shiftNotes.observations")!
        .props.value,
      "Keep draft",
    );
    renderer.unmount();
  });
}

for (const state of [
  "key pending",
  "key failed",
  "query pending",
  "query failed",
  "unreadable",
  "empty",
  "success",
]) {
  test(`previous handover shows its ${state} state without claiming an unconfirmed absence`, async () => {
    currentNotes = [
      {
        ...clinicalNote(),
        payload: { kind: "message", text: "Recados carregados" },
        caregiverId: null,
      },
    ];
    previousNotes = [{ ...clinicalNote(), shiftKey: "2026-10-31:day" }];
    if (state === "key pending") waitingKey = true;
    if (state === "key failed") failedKey = true;
    if (state.startsWith("query")) waitingPrevious = true;
    if (state === "unreadable") {
      previousNotes = [];
      unreadablePrevious = 1;
    }
    if (state === "empty") previousNotes = [];
    const { render, renderer } = await mount();
    if (state === "query failed") previousListener!.fail();
    const tree = render();
    assert.ok(text(tree).includes("Recados carregados"));
    assert.equal(text(tree).includes("shiftNotes.noPrevious"), state === "empty");
    const panel = nodes(tree).find(
      (node) =>
        node.type === "View" &&
        nodes(node).some((child) => child.type === "Text" && text(child) === "shiftNotes.previous"),
    )!;
    if (state.endsWith("pending"))
      assert.ok(nodes(panel).some((node) => node.type === "ActivityIndicator"));
    if (state.endsWith("failed")) assert.ok(text(tree).includes("shiftNotes.sectionUnavailable"));
    if (state === "unreadable") assert.ok(text(tree).includes("shiftNotes.unreadableNotes"));
    if (state === "success") assert.ok(text(tree).includes("Pending care"));
    renderer.unmount();
  });
}

for (const state of ["pending", "failed", "unreadable", "empty"]) {
  test(`current empty state waits for all applicable sections: ${state}`, async () => {
    waitingHandovers = state === "pending" || state === "failed";
    unreadableHandovers = state === "unreadable" ? 1 : 0;
    const { render, renderer } = await mount();
    if (state === "failed") listeners.find((listener) => listener.kind === "handover")!.fail();
    assert.equal(text(render()).includes("shiftNotes.empty"), state === "empty");
    nodes(render())
      .find((node) => node.type === "TextInput")!
      .props.onChangeText("Independent message");
    await press(render(), "shiftNotes.save");
    assert.equal(saves[0][3].kind, "message");
    renderer.unmount();
  });
}

test("an unreadable handover by another author does not block editing the readable own handover", async () => {
  const own = { ...clinicalNote(), authorUid: user.uid, caregiverId: "c2" };
  currentNotes = [own];
  unreadableHandovers = 1;
  const { render, renderer } = await mount();
  assert.ok(text(render()).includes("shiftNotes.unreadableNotes"));
  await press(render(), "shiftNotes.edit");
  nodes(render())
    .find((node) => node.props.accessibilityLabel === "shiftNotes.observations")!
    .props.onChangeText("Own edit");
  await press(render(), "shiftNotes.save");
  assert.equal(saves.length, 1);
  assert.equal(saves[0][5], own);
  assert.equal(saves[0][3].observations, "Own edit");
  renderer.unmount();
});

test("an unreadable unknown own handover cannot be treated as a new handover", async () => {
  unreadableHandovers = 1;
  const { render, renderer } = await mount();
  assert.equal(buttonNamed(render(), "shiftNotes.handover").props.disabled, true);
  assert.ok(!text(render()).includes("shiftNotes.empty"));
  renderer.unmount();
});

for (const exists of [false, true]) {
  test(`cached empty current and previous sections wait for server ${exists ? "existing notes" : "confirmed emptiness"}`, async () => {
    waitingHandovers = true;
    waitingPrevious = true;
    const own = { ...clinicalNote(), authorUid: user.uid, caregiverId: "c2" };
    const { render, renderer } = await mount();
    const handovers = listeners.find((listener) => listener.kind === "handover")!;
    handovers.next([], 0, false);
    previousListener!.next([], 0, false);
    assert.equal(buttonNamed(render(), "shiftNotes.handover").props.disabled, true);
    assert.ok(!text(render()).includes("shiftNotes.empty"));
    assert.ok(!text(render()).includes("shiftNotes.noPrevious"));
    assert.ok(text(render()).includes("shiftNotes.awaitingServer"));
    handovers.next(exists ? [own] : [], 0, true);
    previousListener!.next(
      exists ? [{ ...clinicalNote(), shiftKey: "2026-10-31:day" }] : [],
      0,
      true,
    );
    assert.equal(text(render()).includes("shiftNotes.empty"), !exists);
    assert.equal(text(render()).includes("shiftNotes.noPrevious"), !exists);
    await press(render(), "shiftNotes.handover");
    if (!exists)
      nodes(render())
        .find((node) => node.props.accessibilityLabel === "shiftNotes.medication")!
        .props.onPress();
    await press(render(), "shiftNotes.save");
    assert.equal(saves[0][5], exists ? own : undefined);
    renderer.unmount();
  });
}

for (const cachedB of [false, true]) {
  test(`unconfirmed schedule ${cachedB ? "containing removed B" : "omitting occupied B"} cannot finalize the previous handover`, async () => {
    scheduleIsConfirmed = false;
    const prior = { ...clinicalNote(), shiftKey: "2026-10-30:day" };
    previousNotes = [prior];
    const cached = {
      "2026-10-30": { day: ["c1"], night: [] },
      "2026-10-31": { day: cachedB ? ["c1"] : [], night: ["c2"] },
    };
    schedule = cached;
    const { render, renderer } = await mount();
    assert.ok(!text(render()).includes("shiftNotes.noPrevious"));
    assert.ok(!text(render()).includes("Clinical survives"));
    assert.ok(text(render()).includes("shiftNotes.awaitingServer"));
    const confirmed = {
      "2026-10-30": { day: ["c1"], night: [] },
      "2026-10-31": { day: cachedB ? [] : ["c1"], night: ["c2"] },
    };
    scheduleUpdate(confirmed, true);
    render();
    await settle();
    render();
    assert.equal(text(render()).includes("Clinical survives"), cachedB);
    assert.equal(text(render()).includes("shiftNotes.noPrevious"), !cachedB);
    renderer.unmount();
  });
}
