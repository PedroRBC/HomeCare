import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";

const docs = new Map<string, Record<string, unknown>>();
type Ref = { path: string };
const snapshot = (path: string) => ({
  exists: () => docs.has(path),
  data: () => docs.get(path),
});

mock.module("@react-native-firebase/firestore", () => ({
  getFirestore: () => ({}),
  doc: (_db: unknown, ...segments: string[]): Ref => ({ path: segments.join("/") }),
  getDoc: async ({ path }: Ref) => snapshot(path),
  runTransaction: async (_db: unknown, run: (transaction: unknown) => Promise<unknown>) =>
    run({
      get: async ({ path }: Ref) => snapshot(path),
      set: ({ path }: Ref, data: Record<string, unknown>) => docs.set(path, data),
      update: ({ path }: Ref, data: Record<string, unknown>) =>
        docs.set(path, { ...docs.get(path), ...data }),
    }),
}));

const { CaregiverPayService } = await import("./caregiverPay");

const LINK = "caregiver_links/h1__c1";
const KEY = "caregiver_link_keys/h1__c1";
const pay = { frequency: "Semanal" as const, amount: 200, paid: [] };

beforeEach(() => {
  docs.clear();
  docs.set(LINK, { email: "maria@example.com" });
});

test("pay is encrypted with the link key and readable back", async () => {
  await CaregiverPayService.sync("h1__c1", "maria@example.com", "owner", pay);
  const stored = docs.get(LINK)!.pay as string;
  assert.match(stored, /^enc:v1:/);
  assert.equal(docs.get(KEY)!.createdBy, "owner");
  assert.deepEqual(await CaregiverPayService.read("h1__c1", stored), pay);

  // Unchanged pay is not written again
  await CaregiverPayService.sync("h1__c1", "maria@example.com", "owner", pay);
  assert.equal(docs.get(LINK)!.pay, stored);

  await CaregiverPayService.sync("h1__c1", "maria@example.com", "owner", null);
  assert.equal(docs.get(LINK)!.pay, null);
});

test("pay computed for a previous email is never written nor gets a key", async () => {
  docs.set(LINK, { email: "ana@example.com" });
  await CaregiverPayService.sync("h1__c1", "maria@example.com", "owner", pay);
  assert.equal(docs.get(LINK)!.pay, undefined);
  assert.equal(docs.has(KEY), false);
});

test("a rotated key gets the pay written again", async () => {
  await CaregiverPayService.sync("h1__c1", "maria@example.com", "owner", pay);
  docs.delete(KEY);
  await CaregiverPayService.sync("h1__c1", "maria@example.com", "owner", pay);
  const stored = docs.get(LINK)!.pay as string;
  assert.deepEqual(await CaregiverPayService.read("h1__c1", stored), pay);
});
