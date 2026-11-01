import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { deleteHouseShiftNotes } from "./cleanup.js";

initializeApp();

export const cleanupHouseShiftNotes = onDocumentDeleted(
  { document: "houses/{houseId}", retry: true },
  async (event) => {
    await deleteHouseShiftNotes(getFirestore(), event.params.houseId);
  },
);
