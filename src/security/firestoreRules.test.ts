/**
 * Security rules tests. They need the Firestore emulator, e.g.:
 *   firebase emulators:exec --project demo-homecare-rules --only firestore "bun run test:rules"
 * Without FIRESTORE_EMULATOR_HOST they are skipped, unless REQUIRE_FIRESTORE_EMULATOR
 * is set (as in CI), where a missing emulator is an error.
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
  Timestamp,
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
  deleteDoc,
} from "firebase/firestore";

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
if (!emulator && process.env.REQUIRE_FIRESTORE_EMULATOR) {
  throw new Error("REQUIRE_FIRESTORE_EMULATOR is set but FIRESTORE_EMULATOR_HOST is not");
}
const KEY = "a".repeat(43) + "=";
let env: RulesTestEnvironment;

const as = (uid: string, email = `${uid}@example.com`, emailVerified = true) =>
  env
    .authenticatedContext(uid, { email, email_verified: emailVerified })
    .firestore() as unknown as Firestore;

const unverified = (uid: string, email = `${uid}@example.com`) => as(uid, email, false);

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

const inDays = (days: number) => Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000);

async function invite(db: Firestore, email: string, id = "inv1", expiresAtTs = inDays(7)) {
  await setDoc(doc(db, "house_invitations", id), {
    id,
    houseId: "h1",
    houseName: "Casa",
    invitedEmail: email,
    invitedBy: "owner",
    invitedByName: "owner",
    role: "manager",
    status: "pending",
    expiresAtTs,
  });
}

function acceptBatch(
  db: Firestore,
  uid: string,
  invitationId = "inv1",
  entry: Record<string, unknown> = manager(uid),
) {
  const batch = writeBatch(db);
  batch.update(doc(db, "house_invitations", invitationId), { status: "accepted" });
  batch.set(doc(db, "user_house_access", `h1_${uid}`), {
    userId: uid,
    houseId: "h1",
    role: "manager",
    invitationId,
  });
  batch.update(doc(db, "houses", "h1"), { managers: arrayUnion(entry) });
  return batch.commit();
}

const pendingLink = (email = "cuidadora@example.com") => ({
  houseId: "h1",
  houseName: "Casa",
  caregiverId: "c1",
  caregiverName: "Maria",
  email,
  status: "pending",
  shifts: ["2026-10-04:day"],
});

function acceptLink(db: Firestore, uid: string, linkId = "h1__c1", houseId = "h1") {
  const batch = writeBatch(db);
  batch.update(doc(db, "caregiver_links", linkId), { status: "accepted" });
  batch.set(doc(db, "caregiver_access", `${houseId}_${uid}`), { userId: uid, houseId, linkId });
  return batch.commit();
}

const describeWithEmulator = emulator ? describe : describe.skip;

describeWithEmulator("firestore.rules", () => {
  before(async () => {
    const [host, port] = emulator!.split(":");
    env = await initializeTestEnvironment({
      projectId: process.env.FIRESTORE_TEST_PROJECT ?? "demo-homecare-rules",
      firestore: {
        host,
        port: Number(port),
        // Overridable to check that a test catches a regression in another rules file
        rules: readFileSync(process.env.FIRESTORE_RULES_FILE ?? "firestore.rules", "utf8"),
      },
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
  test("expired invitations can't be accepted", async () => {
    await createHouse(as("owner"));
    await env.withSecurityRulesDisabled(async (context) => {
      await invite(
        context.firestore() as unknown as Firestore,
        "guest@example.com",
        "inv1",
        inDays(-1),
      );
    });
    await assertFails(acceptBatch(as("guest"), "guest"));
  });

  test("a leaving manager removes only their own entry", async () => {
    await createHouse(as("owner"));
    await invite(as("owner"), "guest@example.com");
    await acceptBatch(as("guest"), "guest");

    const guest = as("guest");
    const house = (await getDoc(doc(guest, "houses", "h1"))).data()!;
    const leave = (managers: unknown[]) => {
      const batch = writeBatch(guest);
      batch.update(doc(guest, "houses", "h1"), { managers });
      batch.delete(doc(guest, "user_house_access", "h1_guest"));
      return batch.commit();
    };
    const keep = (userId: string) => house.managers.filter((m: any) => m.userId !== userId);

    await assertFails(leave(keep("owner")));
    await assertFails(leave([]));
    await assertSucceeds(leave(keep("guest")));
  });

  test("an unverified email grants no invitation or caregiver link", async () => {
    await createHouse(as("owner"));
    await invite(as("owner"), "guest@example.com");
    await setDoc(doc(as("owner"), "caregiver_links", "h1__c1"), pendingLink("guest@example.com"));

    // Someone who signed up with the address but never proved owning it
    const squatter = unverified("squatter", "guest@example.com");
    await assertFails(getDoc(doc(squatter, "house_invitations", "inv1")));
    await assertFails(
      getDocs(
        query(
          collection(squatter, "house_invitations"),
          where("invitedEmail", "==", "guest@example.com"),
        ),
      ),
    );
    await assertFails(acceptBatch(squatter, "squatter"));
    await assertFails(getDoc(doc(squatter, "caregiver_links", "h1__c1")));
    await assertFails(acceptLink(squatter, "squatter"));

    // Once verified, the same address works
    const guest = as("guest", "guest@example.com");
    await assertSucceeds(getDoc(doc(guest, "caregiver_links", "h1__c1")));
    await assertSucceeds(acceptBatch(guest, "guest"));
  });

  test("a joining manager can only add their own plain manager entry", async () => {
    await createHouse(as("owner"));
    await invite(as("owner"), "guest@example.com");
    const guest = as("guest");

    await assertFails(acceptBatch(guest, "guest", "inv1", { ...manager("guest"), role: "owner" }));
    await assertFails(acceptBatch(guest, "guest", "inv1", manager("someone-else")));
    await assertFails(
      acceptBatch(guest, "guest", "inv1", { ...manager("guest"), email: "other@example.com" }),
    );
    await assertFails(acceptBatch(guest, "guest", "inv1", { ...manager("guest"), addedBy: "x" }));
    await assertFails(acceptBatch(guest, "guest", "inv1", { ...manager("guest"), admin: true }));
    const { displayName: _name, ...missingName } = manager("guest");
    await assertFails(acceptBatch(guest, "guest", "inv1", missingName));
    await assertFails(
      acceptBatch(guest, "guest", "inv1", { ...manager("guest"), displayName: 12 }),
    );
    await assertFails(acceptBatch(guest, "guest", "inv1", { ...manager("guest"), addedAt: null }));
    await assertSucceeds(acceptBatch(guest, "guest"));
  });

  test("an owner cannot change a house's document identity", async () => {
    const owner = as("owner");
    await createHouse(owner);
    await assertFails(updateDoc(doc(owner, "houses", "h1"), { id: "another-house" }));
  });

  test("older plaintext writes cannot overwrite fields that were already encrypted", async () => {
    const owner = as("owner");
    await createHouse(owner);
    const caregiver = doc(owner, "houses/h1/caregivers/c1");
    await setDoc(caregiver, { name: "enc:v1:name", amount: "enc:v1:amount" });
    await assertFails(updateDoc(caregiver, { name: "Plain name" }));
    await assertFails(updateDoc(caregiver, { amount: 200 }));
    await assertSucceeds(updateDoc(caregiver, { disabled: true }));
    await assertSucceeds(updateDoc(caregiver, { name: "enc:v1:new-name" }));
  });

  test("old clients cannot create new plaintext caregiver or payment-history fields", async () => {
    const owner = as("owner");
    await createHouse(owner);
    await assertFails(
      setDoc(doc(owner, "houses/h1/caregivers/plain"), { name: "Ana", amount: 200 }),
    );
    await assertFails(
      setDoc(doc(owner, "houses/h1/paymentHistory/plain"), { caregiverName: "Ana", amount: 200 }),
    );
    await assertSucceeds(
      setDoc(doc(owner, "houses/h1/caregivers/encrypted"), {
        name: "enc:v1:name",
        amount: "enc:v1:amount",
      }),
    );
    await assertFails(
      setDoc(doc(owner, "houses/h1/caregivers/plain-email"), {
        name: "enc:v1:name",
        email: "ana@example.com",
      }),
    );
  });

  test("sensitive records cannot start empty and later acquire plaintext fields", async () => {
    const owner = as("owner");
    await createHouse(owner);
    for (const collectionName of ["caregivers", "paymentHistory"]) {
      await assertFails(setDoc(doc(owner, `houses/h1/${collectionName}/empty`), {}));
      await assertFails(
        setDoc(doc(owner, `houses/h1/${collectionName}/metadata`), {
          id: "metadata",
          createdAt: "now",
        }),
      );
      await assertFails(
        setDoc(doc(owner, `houses/h1/${collectionName}/null`), {
          name: null,
          caregiverName: null,
          amount: null,
        }),
      );
      const started = doc(owner, `houses/h1/${collectionName}/started`);
      await assertSucceeds(setDoc(started, { amount: "enc:v1:amount" }));
      await assertFails(
        updateDoc(
          started,
          collectionName === "caregivers"
            ? { name: "Plain name" }
            : { caregiverName: "Plain name" },
        ),
      );
    }
  });

  test("a legacy owner grant cannot claim a house created by somebody else", async () => {
    await createHouse(as("owner"));
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore() as unknown as Firestore, "user_house_access", "forged-legacy"),
        { userId: "intruder", houseId: "h1", role: "owner" },
      );
    });
    await assertFails(
      setDoc(doc(as("intruder"), "user_house_access", "h1_intruder"), {
        userId: "intruder",
        houseId: "h1",
        role: "owner",
        legacyAccessId: "forged-legacy",
      }),
    );
  });

  test("optional sensitive fields added to migrated records must also be encrypted", async () => {
    const owner = as("owner");
    await createHouse(owner);
    const caregiver = doc(owner, "houses/h1/caregivers/optional");
    await setDoc(caregiver, { name: "enc:v1:name", amount: "enc:v1:amount" });
    await assertFails(updateDoc(caregiver, { email: "plain@example.com" }));
    await assertFails(updateDoc(caregiver, { dayAmount: 100 }));
    await assertSucceeds(updateDoc(caregiver, { email: "enc:v1:email", dayAmount: "enc:v1:day" }));
    const history = doc(owner, "houses/h1/paymentHistory/optional");
    await setDoc(history, { caregiverName: "enc:v1:name", amount: "enc:v1:amount" });
    await assertFails(updateDoc(history, { managerName: "Plain manager" }));
    await assertSucceeds(updateDoc(history, { managerName: "enc:v1:manager" }));
  });

  test("an unverified account can export and remove its own profile and membership", async () => {
    const owner = unverified("owner");
    await setDoc(doc(owner, "users", "owner"), { id: "owner", email: "owner@example.com" });
    await createHouse(owner);
    await assertSucceeds(getDoc(doc(owner, "users", "owner")));
    await assertSucceeds(getDoc(doc(owner, "houses", "h1")));
    const remove = writeBatch(owner);
    remove.delete(doc(owner, "house_keys", "h1"));
    remove.delete(doc(owner, "houses", "h1"));
    remove.delete(doc(owner, "user_house_access", "h1_owner"));
    await assertSucceeds(remove.commit());
    await assertSucceeds(deleteDoc(doc(owner, "users", "owner")));
  });

  test("accepted caregiver links stay private to the house and the caregiver", async () => {
    await createHouse(as("owner"));
    await createHouse(as("other-owner"), "h2", "other-owner");
    const owner = as("owner");
    await setDoc(doc(owner, "caregiver_links", "h1__c1"), pendingLink());
    await assertSucceeds(acceptLink(as("cg", "cuidadora@example.com"), "cg"));

    // A manager of another house, or any signed-in user, can't read or search it
    for (const outsider of [as("other-owner"), as("stranger")]) {
      await assertFails(getDoc(doc(outsider, "caregiver_links", "h1__c1")));
      await assertFails(
        getDocs(
          query(
            collection(outsider, "caregiver_links"),
            where("email", "in", ["cuidadora@example.com"]),
            where("status", "==", "accepted"),
          ),
        ),
      );
    }

    // Her own house and herself can
    await assertSucceeds(
      getDocs(query(collection(owner, "caregiver_links"), where("houseId", "==", "h1"))),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(as("cg", "cuidadora@example.com"), "caregiver_links"),
          where("email", "==", "cuidadora@example.com"),
        ),
      ),
    );
  });

  test("only the caregiver accepts a link; a new email starts over as pending", async () => {
    await createHouse(as("owner"));
    const owner = as("owner");
    const link = doc(owner, "caregiver_links", "h1__c1");

    await assertFails(setDoc(link, { ...pendingLink(), status: "accepted" }));
    await assertSucceeds(setDoc(link, pendingLink()));
    await assertFails(updateDoc(link, { status: "accepted" }));

    await assertSucceeds(acceptLink(as("cg", "cuidadora@example.com"), "cg"));
    // Name and shift updates keep her answer
    await assertSucceeds(updateDoc(link, { caregiverName: "Maria S.", shifts: [] }));
    // Moving an accepted link to another person's email without resetting it
    await assertFails(updateDoc(link, { email: "outra@example.com" }));
    await assertSucceeds(updateDoc(link, { email: "outra@example.com", status: "pending" }));
    // Resending an invitation resets it to pending
    await assertSucceeds(updateDoc(link, { status: "pending" }));
  });

  test("invitations from before server-side expiry can't be accepted, only reissued", async () => {
    await createHouse(as("owner"));
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, "house_invitations", "legacy"), {
        id: "legacy",
        houseId: "h1",
        invitedEmail: "guest@example.com",
        invitedBy: "owner",
        role: "manager",
        status: "pending",
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
    });
    await assertFails(acceptBatch(as("guest"), "guest", "legacy"));

    const owner = as("owner");
    const reissue = writeBatch(owner);
    reissue.delete(doc(owner, "house_invitations", "legacy"));
    await assertSucceeds(reissue.commit());
    await invite(owner, "guest@example.com", "inv2");
    await assertSucceeds(acceptBatch(as("guest"), "guest", "inv2"));
  });
});
