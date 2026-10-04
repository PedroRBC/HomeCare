/**
 * Security rules tests. They need the Firestore emulator, e.g.:
 *   firebase emulators:exec --only firestore "bun test src/security"
 * Without FIRESTORE_EMULATOR_HOST they are skipped.
 */
import { after, before, beforeEach, describe, test } from "node:test";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const KEY = "a".repeat(43) + "=";
let env: RulesTestEnvironment;

const as = (uid: string, email = `${uid}@example.com`) =>
  env.authenticatedContext(uid, { email }).firestore() as unknown as Firestore;

const manager = (userId: string, role = "manager") => ({
  userId,
  email: `${userId}@example.com`,
  displayName: userId,
  role,
  addedAt: "2026-10-04T00:00:00.000Z",
  addedBy: "owner",
});

async function createHouse(db: Firestore, houseId = "h1", uid = "owner") {
  const batch = writeBatch(db);
  batch.set(doc(db, "houses", houseId), {
    id: houseId,
    name: "Casa",
    createdBy: uid,
    managers: [manager(uid, "owner")],
  });
  batch.set(doc(db, "user_house_access", `${houseId}_${uid}`), {
    userId: uid,
    houseId,
    role: "owner",
  });
  batch.set(doc(db, "house_keys", houseId), {
    key: KEY,
    version: 1,
    createdAt: "now",
    createdBy: uid,
  });
  await batch.commit();
}

async function invite(db: Firestore, email: string, id = "inv1") {
  await setDoc(doc(db, "house_invitations", id), {
    id,
    houseId: "h1",
    houseName: "Casa",
    invitedEmail: email,
    invitedBy: "owner",
    invitedByName: "owner",
    role: "manager",
    status: "pending",
  });
}

function acceptBatch(db: Firestore, uid: string, invitationId = "inv1") {
  const batch = writeBatch(db);
  batch.update(doc(db, "house_invitations", invitationId), { status: "accepted" });
  batch.set(doc(db, "user_house_access", `h1_${uid}`), {
    userId: uid,
    houseId: "h1",
    role: "manager",
    invitationId,
  });
  batch.update(doc(db, "houses", "h1"), { managers: arrayUnion(manager(uid)) });
  return batch.commit();
}

const describeWithEmulator = emulator ? describe : describe.skip;

describeWithEmulator("firestore.rules", () => {
  before(async () => {
    const [host, port] = emulator!.split(":");
    env = await initializeTestEnvironment({
      projectId: "demo-homecare-rules",
      firestore: { host, port: Number(port), rules: readFileSync("firestore.rules", "utf8") },
    });
  });
  beforeEach(() => env.clearFirestore());
  after(() => env?.cleanup());

  test("the owner creates a house with its key and reads its data", async () => {
    const db = as("owner");
    await assertSucceeds(createHouse(db));
    await assertSucceeds(getDoc(doc(db, "house_keys", "h1")));
    await assertSucceeds(setDoc(doc(db, "houses/h1/caregivers/c1"), { name: "enc:v1:x" }));
  });

  test("strangers can't read a house, its key, its data or someone's profile", async () => {
    await createHouse(as("owner"));
    await setDoc(doc(as("owner"), "users", "owner"), { id: "owner", email: "owner@example.com" });
    const db = as("stranger");
    await assertFails(getDoc(doc(db, "houses", "h1")));
    await assertFails(getDoc(doc(db, "house_keys", "h1")));
    await assertFails(getDocs(collection(db, "houses/h1/caregivers")));
    await assertFails(getDoc(doc(db, "users", "owner")));
    await assertFails(
      getDocs(query(collection(db, "user_house_access"), where("houseId", "==", "h1"))),
    );
  });

  test("nobody can claim an existing house or replace its key", async () => {
    await createHouse(as("owner"));
    const db = as("stranger");
    await assertFails(
      setDoc(doc(db, "user_house_access", "h1_stranger"), {
        userId: "stranger",
        houseId: "h1",
        role: "owner",
      }),
    );
    await assertFails(
      setDoc(doc(as("owner"), "house_keys", "h1"), {
        key: KEY,
        version: 2,
        createdAt: "now",
        createdBy: "owner",
      }),
    );
  });

  test("an invited user joins through a pending invitation, only once", async () => {
    await createHouse(as("owner"));
    await invite(as("owner"), "guest@example.com");

    const guest = as("guest");
    await assertSucceeds(
      getDocs(
        query(
          collection(guest, "house_invitations"),
          where("invitedEmail", "==", "guest@example.com"),
        ),
      ),
    );
    await assertSucceeds(acceptBatch(guest, "guest"));
    await assertSucceeds(getDoc(doc(guest, "house_keys", "h1")));

    // Removed by the owner, the accepted invitation can't be used again
    const owner = as("owner");
    await assertSucceeds(
      writeBatch(owner)
        .delete(doc(owner, "user_house_access", "h1_guest"))
        .commit(),
    );
    await assertFails(
      setDoc(doc(guest, "user_house_access", "h1_guest"), {
        userId: "guest",
        houseId: "h1",
        role: "manager",
        invitationId: "inv1",
      }),
    );
  });

  test("an invitation for someone else can't be accepted", async () => {
    await createHouse(as("owner"));
    await invite(as("owner"), "guest@example.com");
    await assertFails(acceptBatch(as("intruder"), "intruder"));
  });

  test("only the owner invites, and managers can't delete the house", async () => {
    await createHouse(as("owner"));
    await invite(as("owner"), "guest@example.com");
    await acceptBatch(as("guest"), "guest");

    const guest = as("guest");
    await assertFails(invite(guest, "other@example.com", "inv2"));
    await assertFails(
      writeBatch(guest)
        .delete(doc(guest, "houses", "h1"))
        .commit(),
    );
    await assertFails(updateDoc(doc(guest, "houses", "h1"), { createdBy: "guest" }));
  });

  test("legacy access records migrate only for their own user", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, "houses", "h1"), { id: "h1", createdBy: "owner", managers: [] });
      await setDoc(doc(db, "user_house_access", "random1"), {
        userId: "owner",
        houseId: "h1",
        role: "owner",
      });
    });

    const migrated = {
      userId: "owner",
      houseId: "h1",
      role: "owner",
      legacyAccessId: "random1",
    };
    await assertFails(
      setDoc(doc(as("thief"), "user_house_access", "h1_thief"), { ...migrated, userId: "thief" }),
    );

    const db = as("owner");
    const batch = writeBatch(db);
    batch.set(doc(db, "user_house_access", "h1_owner"), migrated);
    batch.delete(doc(db, "user_house_access", "random1"));
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(db, "houses", "h1")));
  });

  test("the owner deletes the house, its key and every access record at once", async () => {
    await createHouse(as("owner"));
    await invite(as("owner"), "guest@example.com");
    await acceptBatch(as("guest"), "guest");

    const db = as("owner");
    const access = await getDocs(
      query(collection(db, "user_house_access"), where("houseId", "==", "h1")),
    );
    const batch = writeBatch(db);
    batch.delete(doc(db, "house_keys", "h1"));
    batch.delete(doc(db, "houses", "h1"));
    access.docs.forEach((record) => batch.delete(record.ref));
    await assertSucceeds(batch.commit());
    await assertFails(getDoc(doc(as("guest"), "house_keys", "h1")));
  });
  test("a caregiver reads the schedule only while her link is accepted", async () => {
    await createHouse(as("owner"));
    const owner = as("owner");
    // Managers check whether a caregiver already has a link before writing it
    await assertSucceeds(getDoc(doc(owner, "caregiver_links", "h1__c1")));
    await setDoc(doc(owner, "houses/h1/schedule/2026-10-04"), { day: ["c1"], night: [] });
    await setDoc(doc(owner, "caregiver_links", "h1__c1"), {
      houseId: "h1",
      caregiverId: "c1",
      email: "cuidadora@example.com",
      status: "pending",
    });

    const caregiver = as("cg", "cuidadora@example.com");
    const accept = () => {
      const batch = writeBatch(caregiver);
      batch.update(doc(caregiver, "caregiver_links", "h1__c1"), { status: "accepted" });
      batch.set(doc(caregiver, "caregiver_access", "h1_cg"), {
        userId: "cg",
        houseId: "h1",
        linkId: "h1__c1",
      });
      return batch.commit();
    };

    await assertFails(getDocs(collection(caregiver, "houses/h1/schedule")));
    await assertSucceeds(accept());
    await assertSucceeds(getDocs(collection(caregiver, "houses/h1/schedule")));
    await assertFails(getDocs(collection(caregiver, "houses/h1/caregivers")));
    await assertFails(getDoc(doc(caregiver, "house_keys", "h1")));

    // The manager removes her email: access ends with the link
    await writeBatch(owner)
      .delete(doc(owner, "caregiver_links", "h1__c1"))
      .commit();
    await assertFails(getDocs(collection(caregiver, "houses/h1/schedule")));
  });

  test("someone else can't claim a caregiver's link or answer for her", async () => {
    await createHouse(as("owner"));
    await setDoc(doc(as("owner"), "caregiver_links", "h1__c1"), {
      houseId: "h1",
      caregiverId: "c1",
      email: "cuidadora@example.com",
      status: "pending",
    });
    const intruder = as("intruder");
    await assertFails(
      updateDoc(doc(intruder, "caregiver_links", "h1__c1"), { status: "accepted" }),
    );
    await assertFails(getDoc(doc(intruder, "caregiver_links", "h1__c1")));
    await assertFails(
      setDoc(doc(intruder, "caregiver_access", "h1_intruder"), {
        userId: "intruder",
        houseId: "h1",
        linkId: "h1__c1",
      }),
    );
    await assertFails(
      setDoc(doc(intruder, "caregiver_links", "h1__c2"), {
        houseId: "h1",
        email: "intruder@example.com",
        status: "accepted",
      }),
    );
  });
});
