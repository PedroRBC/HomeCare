import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
  type DocumentReference,
  type DocumentSnapshot,
  type Transaction,
} from "@react-native-firebase/firestore";
import { decryptValue, encryptValue, generateDataKey, importDataKey } from "@/utils/fieldCrypto";
import {
  notePayloadSchema,
  shiftContextSchema,
  type NotePayload,
  type ShiftContext,
  type ShiftNote,
} from "@/utils/shiftNotes";
import type { DaySchedule } from "@/context/ScheduleContext";

export class NoteConflictError extends Error {}
const notesRef = (houseId: string) => collection(getFirestore(), "houses", houseId, "shiftNotes");
export const noteKeyRef = (houseId: string, clinical = false) =>
  doc(getFirestore(), clinical ? "shift_handover_keys" : "shift_note_keys", houseId);

// No process-level cache; Firestore still owns its device cache. Clinical keys are caregiver-only.
export async function getNoteKey(
  houseId: string,
  userId: string,
  clinical = false,
): Promise<Uint8Array> {
  const ref = noteKeyRef(houseId, clinical);
  const snapshot = await getDoc(ref);
  const encoded = snapshot.exists()
    ? (snapshot.data()!.key as string)
    : await runTransaction(getFirestore(), async (tx) => {
        const current = await tx.get(ref);
        if (current.exists()) return current.data()!.key as string;
        const key = generateDataKey();
        tx.set(ref, { key, createdBy: userId });
        return key;
      });
  return importDataKey(encoded);
}

async function noteTransaction(
  ref: DocumentReference,
  revision: number | undefined,
  work: (tx: Transaction, current: DocumentSnapshot) => Promise<void> | void,
) {
  try {
    await runTransaction(getFirestore(), async (tx) => {
      const current = await tx.get(ref);
      if (
        revision === undefined
          ? current.exists()
          : !current.exists() || current.data()!.revision !== revision
      )
        throw new NoteConflictError();
      await work(tx, current);
    });
  } catch (error) {
    // Rules may reject a stale revision before Firestore reports a retryable conflict.
    if ((error as { code?: string }).code?.includes("permission-denied")) {
      const latest = await getDoc(ref).catch(() => null);
      if (
        latest &&
        (revision === undefined
          ? latest.exists()
          : !latest.exists() || latest.data()!.revision !== revision)
      )
        throw new NoteConflictError();
    }
    throw error;
  }
}

function decode(record: QueryDocumentSnapshot, key: Uint8Array): ShiftNote {
  const data = record.data();
  const payload = notePayloadSchema.parse(
    JSON.parse(String(decryptValue(key, data.payload, `${record.ref.path}:payload`))),
  );
  if (payload.kind !== data.kind) throw new Error("Invalid note kind");
  const ids = payload.kind === "handover" ? payload.pending.map((item) => item.id) : [];
  if (
    Object.keys(data.pendingStatus).length !== ids.length ||
    ids.some((id) => !["open", "done"].includes(data.pendingStatus[id]))
  )
    throw new Error("Invalid pending tasks");
  return {
    id: record.id,
    shiftKey: data.shiftKey,
    authorUid: data.authorUid,
    caregiverId: data.caregiverId,
    pendingStatus: data.pendingStatus,
    revision: data.revision,
    createdAt: data.createdAt?.toDate().toISOString() ?? "",
    payload,
  };
}

export const ShiftNotesService = {
  subscribeSchedule(
    houseId: string,
    update: (schedule: Record<string, Partial<DaySchedule>>) => void,
    fail: (error: Error) => void,
  ) {
    return onSnapshot(
      collection(getFirestore(), "houses", houseId, "schedule"),
      (snapshot) => {
        update(Object.fromEntries(snapshot.docs.map((record) => [record.id, record.data()])));
      },
      fail,
    );
  },
  subscribe(
    houseId: string,
    shiftKey: string,
    kind: NotePayload["kind"],
    key: Uint8Array,
    update: (notes: ShiftNote[]) => void,
    fail: (error: Error) => void,
  ) {
    return onSnapshot(
      query(notesRef(houseId), where("kind", "==", kind), where("shiftKey", "==", shiftKey)),
      (snapshot) => {
        try {
          update(
            snapshot.docs
              .map((record) => decode(record, key))
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
          );
        } catch (error) {
          fail(error as Error);
        }
      },
      fail,
    );
  },
  subscribePrevious(
    houseId: string,
    caregiverId: string,
    current: string,
    previous: string,
    key: Uint8Array,
    update: (notes: ShiftNote[]) => void,
    fail: (error: Error) => void,
  ) {
    const ref = query(
      notesRef(houseId),
      where("kind", "==", "handover"),
      where("caregiverId", "==", caregiverId),
      where("shiftKey", "<", current),
      orderBy("shiftKey", "desc"),
      limit(1),
    );
    return onSnapshot(
      ref,
      (snapshot) => {
        try {
          update(
            snapshot.docs
              .filter((record) => record.data().shiftKey === previous)
              .map((record) => decode(record, key)),
          );
        } catch (error) {
          fail(error as Error);
        }
      },
      fail,
    );
  },
  async save(
    context: ShiftContext,
    userId: string,
    key: Uint8Array,
    input: NotePayload,
    existing?: ShiftNote,
  ) {
    shiftContextSchema.parse(context);
    const payload = notePayloadSchema.parse(input);
    const shiftKey = `${context.date}:${context.shift}`;
    const ref = existing
      ? doc(notesRef(context.houseId), existing.id)
      : payload.kind === "handover"
        ? doc(notesRef(context.houseId), `${shiftKey}__${userId}`)
        : doc(notesRef(context.houseId));
    const encrypted = encryptValue(key, JSON.stringify(payload), `${ref.path}:payload`);
    await noteTransaction(ref, existing?.revision, async (tx, current) => {
      const access =
        payload.kind === "handover"
          ? await tx.get(doc(getFirestore(), "caregiver_access", `${context.houseId}_${userId}`))
          : null;
      const link = access?.exists()
        ? await tx.get(doc(getFirestore(), "caregiver_links", access.data()!.linkId))
        : null;
      const pendingStatus = Object.fromEntries(
        (payload.kind === "handover" ? payload.pending : []).map((item) => [
          item.id,
          current.data()?.pendingStatus?.[item.id] ?? "open",
        ]),
      );
      if (current.exists()) {
        const before = current.data()!;
        if (
          before.authorUid !== userId ||
          before.shiftKey !== shiftKey ||
          before.kind !== payload.kind
        )
          throw new Error("Invalid note context");
        tx.update(ref, {
          payload: encrypted,
          pendingStatus,
          revision: existing!.revision + 1,
          updatedBy: userId,
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(ref, {
          authorUid: userId,
          caregiverId: payload.kind === "handover" ? link?.data()?.caregiverId : null,
          kind: payload.kind,
          shiftKey,
          scheduleRef: doc(getFirestore(), "houses", context.houseId, "schedule", context.date),
          payload: encrypted,
          pendingStatus,
          resolvedFrom: null,
          revision: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        });
      }
    });
  },
  async resolve(
    context: ShiftContext,
    userId: string,
    note: ShiftNote,
    itemId: string,
    status: "open" | "done",
  ) {
    shiftContextSchema.parse(context);
    const ref = doc(notesRef(context.houseId), note.id);
    await noteTransaction(ref, note.revision, async (tx) => {
      if (note.payload.kind !== "handover" || !Object.hasOwn(note.pendingStatus, itemId))
        throw new Error("Invalid pending task");
      tx.update(ref, {
        pendingStatus: { ...note.pendingStatus, [itemId]: status },
        resolvedFrom: `${context.date}:${context.shift}`,
        revision: note.revision + 1,
        updatedBy: userId,
        updatedAt: serverTimestamp(),
      });
    });
  },
  async remove(houseId: string, note: ShiftNote) {
    const ref = doc(notesRef(houseId), note.id);
    await noteTransaction(ref, note.revision, async (tx) => {
      tx.delete(ref);
    });
  },
  async export(
    houseId: string,
    userId: string,
    clinical = false,
  ): Promise<Record<string, unknown>[]> {
    const snapshot = await getDocs(
      query(notesRef(houseId), where("kind", "==", clinical ? "handover" : "message")),
    );
    if (!snapshot.size) return [];
    const key = await getNoteKey(houseId, userId, clinical);
    return snapshot.docs.map((record) => ({
      ...decode(record, key),
      scheduleId: record.data().shiftKey.split(":")[0],
    }));
  },
  async exportOwn(userId: string): Promise<Record<string, unknown>[]> {
    const snapshot = await getDocs(
      query(collectionGroup(getFirestore(), "shiftNotes"), where("authorUid", "==", userId)),
    );
    const keys = new Map<string, Uint8Array | null>();
    const exported: Record<string, unknown>[] = [];
    for (const record of snapshot.docs) {
      const houseId = record.ref.parent.parent!.id;
      const data = record.data();
      const clinical = data.kind === "handover";
      const keyId = `${houseId}:${clinical}`;
      if (!keys.has(keyId)) {
        try {
          keys.set(keyId, await getNoteKey(houseId, userId, clinical));
        } catch (error) {
          if ((error as { code?: string }).code?.includes("permission-denied"))
            keys.set(keyId, null);
          else throw error;
        }
      }
      const key = keys.get(keyId);
      exported.push(
        key
          ? { ...decode(record, key), houseId }
          : {
              id: record.id,
              houseId,
              shiftKey: data.shiftKey,
              kind: data.kind,
              authorUid: userId,
              readable: false,
              encryptedPayload: data.payload,
            },
      );
    }
    return exported;
  },
  async deleteOwn(userId: string) {
    const snapshot = await getDocs(
      query(collectionGroup(getFirestore(), "shiftNotes"), where("authorUid", "==", userId)),
    );
    for (let i = 0; i < snapshot.docs.length; i += 400) {
      const batch = writeBatch(getFirestore());
      snapshot.docs.slice(i, i + 400).forEach((record) => batch.delete(record.ref));
      await batch.commit();
    }
  },
};
