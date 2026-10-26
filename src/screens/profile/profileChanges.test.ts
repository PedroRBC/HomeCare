import { test } from "node:test";
import assert from "node:assert/strict";
import { decideProfileSave } from "./profileChanges";

test("avatar icon-only change is detected as a change requiring save", () => {
  const decision = decideProfileSave({
    displayName: "Ana",
    storedName: "Ana",
    avatarConfig: { icon: "heart", color: "#059669" },
    storedAvatarConfig: { icon: "person", color: "#059669" },
  });
  assert.deepEqual(decision, { kind: "save", trimmedName: "Ana" });
});

test("avatar color-only change is detected as a change requiring save", () => {
  const decision = decideProfileSave({
    displayName: "Ana",
    storedName: "Ana",
    avatarConfig: { icon: "person", color: "#3b82f6" },
    storedAvatarConfig: { icon: "person", color: "#059669" },
  });
  assert.deepEqual(decision, { kind: "save", trimmedName: "Ana" });
});

test("unchanged name and avatar reports no changes", () => {
  const decision = decideProfileSave({
    displayName: "Ana",
    storedName: "Ana",
    avatarConfig: { icon: "person", color: "#059669" },
    storedAvatarConfig: { icon: "person", color: "#059669" },
  });
  assert.deepEqual(decision, { kind: "noChanges" });
});

test("email-derived name prefill with no stored name counts as a change and saves", () => {
  const decision = decideProfileSave({
    displayName: "ana.silva",
    storedName: undefined,
    avatarConfig: { icon: "person", color: "#059669" },
    storedAvatarConfig: { icon: "person", color: "#059669" },
  });
  assert.deepEqual(decision, { kind: "save", trimmedName: "ana.silva" });
});

test("blank display name reports that a name is required", () => {
  const decision = decideProfileSave({
    displayName: "   ",
    storedName: "Ana",
    avatarConfig: { icon: "person", color: "#059669" },
    storedAvatarConfig: { icon: "person", color: "#059669" },
  });
  assert.deepEqual(decision, { kind: "nameRequired" });
});
