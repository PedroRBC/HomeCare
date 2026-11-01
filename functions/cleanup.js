// Family accounts cannot enumerate clinical documents; cleanup runs with trusted credentials.
export async function deleteHouseShiftNotes(db, houseId) {
  await db.recursiveDelete(db.collection("houses").doc(houseId).collection("shiftNotes"));
  const batch = db.batch();
  batch.delete(db.collection("shift_note_keys").doc(houseId));
  batch.delete(db.collection("shift_handover_keys").doc(houseId));
  await batch.commit();
}
