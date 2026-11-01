import { getAuth } from "@react-native-firebase/auth";
import { randomUUID } from "expo-crypto";
import {
  collection,
  collectionGroup,
  doc,
  documentId,
  getDoc,
  getDocFromServer,
  getDocsFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
  type Query,
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
const NOTE_PAGE_SIZE = 100;
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

function sameVersion(current: DocumentSnapshot, expected: ShiftNote | undefined) {
  return expected
    ? current.exists() &&
        current.data()!.revision === expected.revision &&
        current.data()!.generation === expected.generation
    : !current.exists();
}

async function noteTransaction(
  ref: DocumentReference,
  expected: ShiftNote | undefined,
  work: (tx: Transaction, current: DocumentSnapshot) => Promise<void> | void,
) {
  try {
    await runTransaction(getFirestore(), async (tx) => {
      const current = await tx.get(ref);
      if (!sameVersion(current, expected)) throw new NoteConflictError();
      await work(tx, current);
    });
  } catch (error) {
    // Rules may reject a stale version before Firestore reports a retryable conflict.
    if ((error as { code?: string }).code?.includes("permission-denied")) {
      const latest = await getDocFromServer(ref).catch(() => null);
      if (latest && !sameVersion(latest, expected)) throw new NoteConflictError();
    }
    throw error;
  }
}

function decode(record: QueryDocumentSnapshot, key: Uint8Array): ShiftNote {
  const data = record.data();
  const payload = notePayloadSchema.parse(
    JSON.parse(String(decryptValue(key, data.payload, `${record.ref.path}:payload`))),
  );
  if (payload.kind !== data.kind || typeof data.generation !== "string" || !data.generation)
    throw new Error("Invalid note metadata");
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
    generation: data.generation,
    createdAt: data.createdAt?.toDate().toISOString() ?? "",
    payload,
  };
}

type NoteUpdate = (notes: ShiftNote[], unreadable: number) => void;
function subscribeNotes(
  ref: Query,
  key: Uint8Array,
  update: NoteUpdate,
  fail: (error: Error) => void,
) {
  return onSnapshot(
    ref,
    (snapshot) => {
      const notes: ShiftNote[] = [];
      let unreadable = 0;
      for (const record of snapshot.docs) {
        try {
          notes.push(decode(record, key));
        } catch {
          unreadable++;
        }
      }
      notes.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      update(notes, unreadable);
    },
    fail,
  );
}

async function assignedCaregiverId(tx: Transaction, houseId: string, linkId: string | null) {
  if (!linkId || linkId.includes("/")) throw new Error("Missing assigned caregiver link");
  const link = await tx.get(doc(getFirestore(), "caregiver_links", linkId));
  const data = link.data();
  if (
    !link.exists() ||
    data!.houseId !== houseId ||
    typeof data!.caregiverId !== "string" ||
    linkId !== `${houseId}__${data!.caregiverId}` ||
    data!.status !== "accepted" ||
    data!.disabled
  )
    throw new Error("Invalid assigned caregiver link");
  // Rules also bind this link to the authenticated verified email and the real shift.
  return data!.caregiverId as string;
}

function ensureUser(userId: string) {
  if (getAuth().currentUser?.uid !== userId)
    throw new Error("Shift notes belong to a different or ended account session");
}
async function authoritativePage(ref: Query, userId: string) {
  ensureUser(userId);
  const page = await getDocsFromServer(ref);
  ensureUser(userId);
  if (page.metadata.fromCache) throw new Error("An authoritative shift-note read is required");
  return page;
}
function exportRecord(
  record: QueryDocumentSnapshot,
  key: Uint8Array | null,
): Record<string, unknown> {
  if (key) {
    try {
      return { ...decode(record, key) };
    } catch {
      /* Preserve unreadable own data in the archive. */
    }
  }
  const data = record.data();
  return {
    id: record.id,
    shiftKey: data.shiftKey,
    kind: data.kind,
    authorUid: data.authorUid,
    readable: false,
    encryptedPayload: data.payload,
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
      (snapshot) =>
        update(Object.fromEntries(snapshot.docs.map((record) => [record.id, record.data()]))),
      fail,
    );
  },
  subscribe(
    houseId: string,
    shiftKey: string,
    kind: NotePayload["kind"],
    key: Uint8Array,
    update: NoteUpdate,
    fail: (error: Error) => void,
  ) {
    return subscribeNotes(
      query(notesRef(houseId), where("kind", "==", kind), where("shiftKey", "==", shiftKey)),
      key,
      update,
      fail,
    );
  },
  subscribePrevious(
    houseId: string,
    current: string,
    previous: string,
    key: Uint8Array,
    update: NoteUpdate,
    fail: (error: Error) => void,
  ) {
    // The stable shift identifies the handovers; later reassignment must not hide old authors.
    return subscribeNotes(
      query(
        notesRef(houseId),
        where("kind", "==", "handover"),
        where("shiftKey", ">=", previous),
        where("shiftKey", "<", current),
        orderBy("shiftKey", "desc"),
      ),
      key,
      update,
      fail,
    );
  },
  async save(
    context: ShiftContext,
    userId: string,
    key: Uint8Array,
    input: NotePayload,
    caregiverLinkId: string | null,
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
    const generation = existing?.generation ?? randomUUID();
    await noteTransaction(ref, existing, async (tx, current) => {
      const caregiverId =
        payload.kind === "handover"
          ? await assignedCaregiverId(tx, context.houseId, caregiverLinkId)
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
          caregiverId,
          kind: payload.kind,
          shiftKey,
          scheduleRef: doc(getFirestore(), "houses", context.houseId, "schedule", context.date),
          payload: encrypted,
          pendingStatus,
          resolvedFrom: null,
          resolvedByCaregiverId: null,
          revision: 1,
          generation,
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
    caregiverLinkId: string,
  ) {
    shiftContextSchema.parse(context);
    const ref = doc(notesRef(context.houseId), note.id);
    await noteTransaction(ref, note, async (tx) => {
      const caregiverId = await assignedCaregiverId(tx, context.houseId, caregiverLinkId);
      if (note.payload.kind !== "handover" || !Object.hasOwn(note.pendingStatus, itemId))
        throw new Error("Invalid pending task");
      tx.update(ref, {
        pendingStatus: { ...note.pendingStatus, [itemId]: status },
        resolvedFrom: `${context.date}:${context.shift}`,
        resolvedByCaregiverId: caregiverId,
        revision: note.revision + 1,
        updatedBy: userId,
        updatedAt: serverTimestamp(),
      });
    });
  },
  async remove(houseId: string, note: ShiftNote) {
    await noteTransaction(doc(notesRef(houseId), note.id), note, (tx, current) => {
      tx.delete(current.ref);
    });
  },
  async export(
    houseId: string,
    userId: string,
    clinical = false,
  ): Promise<Record<string, unknown>[]> {
    const exported: Record<string, unknown>[] = [];
    let cursor: QueryDocumentSnapshot | undefined;
    let key: Uint8Array | null = null;
    while (true) {
      const page = await authoritativePage(
        query(
          notesRef(houseId),
          where("kind", "==", clinical ? "handover" : "message"),
          orderBy(documentId()),
          limit(NOTE_PAGE_SIZE),
          ...(cursor ? [startAfter(cursor)] : []),
        ),
        userId,
      );
      if (page.docs.length && !key) key = await getNoteKey(houseId, userId, clinical);
      ensureUser(userId);
      exported.push(
        ...page.docs.map((record) => ({
          ...exportRecord(record, key),
          scheduleId: record.data().shiftKey.split(":")[0],
        })),
      );
      if (page.docs.length < NOTE_PAGE_SIZE) return exported;
      cursor = page.docs[page.docs.length - 1];
    }
  },
  async exportOwn(userId: string): Promise<Record<string, unknown>[]> {
    const keys = new Map<string, Uint8Array | null>();
    const exported: Record<string, unknown>[] = [];
    let cursor: QueryDocumentSnapshot | undefined;
    while (true) {
      const page = await authoritativePage(
        query(
          collectionGroup(getFirestore(), "shiftNotes"),
          where("authorUid", "==", userId),
          orderBy(documentId()),
          limit(NOTE_PAGE_SIZE),
          ...(cursor ? [startAfter(cursor)] : []),
        ),
        userId,
      );
      for (const record of page.docs) {
        const houseId = record.ref.parent.parent!.id;
        const clinical = record.data().kind === "handover";
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
        ensureUser(userId);
        exported.push({ ...exportRecord(record, keys.get(keyId)!), houseId });
      }
      if (page.docs.length < NOTE_PAGE_SIZE) return exported;
      cursor = page.docs[page.docs.length - 1];
    }
  },
  async deleteOwn(userId: string) {
    while (true) {
      const page = await authoritativePage(
        query(
          collectionGroup(getFirestore(), "shiftNotes"),
          where("authorUid", "==", userId),
          orderBy(documentId()),
          limit(NOTE_PAGE_SIZE),
        ),
        userId,
      );
      if (page.empty) return;
      const batch = writeBatch(getFirestore());
      page.docs.forEach((record) => batch.delete(record.ref));
      ensureUser(userId);
      await batch.commit();
      ensureUser(userId);
    }
  },
};
