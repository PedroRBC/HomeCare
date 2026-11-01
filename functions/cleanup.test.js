import { test } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { deleteHouseShiftNotes } from "./cleanup.js";

test(
  "deleting a house removes orphaned notes and keys, not another house",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    const app = initializeApp({ projectId: "demo-homecare-notes-cleanup" }, "notes-cleanup-test");
    try {
      const db = getFirestore(app);
      const batch = db.batch();
      for (const path of [
        "houses/h1/shiftNotes/clinical",
        "houses/h1/shiftNotes/message",
        "houses/h2/shiftNotes/keep",
        "shift_note_keys/h1",
        "shift_handover_keys/h1",
      ])
        batch.set(db.doc(path), { fixture: true });
      await batch.commit();
      await deleteHouseShiftNotes(db, "h1");
      assert.equal((await db.collection("houses/h1/shiftNotes").get()).size, 0);
      assert.equal((await db.doc("shift_note_keys/h1").get()).exists, false);
      assert.equal((await db.doc("shift_handover_keys/h1").get()).exists, false);
      assert.equal((await db.doc("houses/h2/shiftNotes/keep").get()).exists, true);
      await deleteHouseShiftNotes(db, "h1");
      await db.doc("houses/h2/shiftNotes/keep").delete();
    } finally {
      await deleteApp(app);
    }
  },
);
