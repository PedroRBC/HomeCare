import { test } from "node:test";
import assert from "node:assert/strict";
import {
  base64ToBytes,
  bytesToBase64,
  decryptValue,
  encryptValue,
  generateDataKey,
  importDataKey,
  isEncryptedValue,
} from "./fieldCrypto";
import { decryptFields, encryptFields, SECURE_FIELDS } from "./secureFields";

const key = importDataKey(generateDataKey());
const path = "houses/h1/caregivers/c1";

test("base64 matches the platform encoding", () => {
  for (const size of [0, 1, 2, 3, 31, 32, 33]) {
    const bytes = crypto.getRandomValues(new Uint8Array(size));
    const expected = Buffer.from(bytes).toString("base64");
    assert.equal(bytesToBase64(bytes), expected);
    assert.deepEqual(base64ToBytes(expected), bytes);
  }
});

test("values round-trip and never show the plain text", () => {
  const name = encryptValue(key, "Maria da Silva", `${path}#name`);
  const amount = encryptValue(key, 180.5, `${path}#amount`);

  assert.ok(isEncryptedValue(name));
  assert.ok(!name.includes("Maria"));
  assert.equal(decryptValue(key, name, `${path}#name`), "Maria da Silva");
  assert.equal(decryptValue(key, amount, `${path}#amount`), 180.5);
});

test("the same value encrypts differently every time", () => {
  assert.notEqual(encryptValue(key, "Ana", "ctx"), encryptValue(key, "Ana", "ctx"));
});

test("decryption fails with another key, another location or tampered data", () => {
  const sealed = encryptValue(key, "Ana", `${path}#name`);
  const otherKey = importDataKey(generateDataKey());
  const bytes = base64ToBytes(sealed.slice("enc:v1:".length));
  bytes[bytes.length - 1] ^= 1;
  const tampered = `enc:v1:${bytesToBase64(bytes)}`;

  assert.throws(() => decryptValue(otherKey, sealed, `${path}#name`));
  assert.throws(() => decryptValue(key, sealed, "houses/h1/caregivers/c2#name"));
  assert.throws(() => decryptValue(key, tampered, `${path}#name`));
});

test("keys must be 256 bits", () => {
  assert.throws(() => importDataKey(bytesToBase64(new Uint8Array(16))));
  assert.equal(importDataKey(generateDataKey()).length, 32);
});

test("records keep non-sensitive fields readable and encrypt the rest", () => {
  const caregiver = {
    id: "c1",
    name: "Ana",
    frequency: "Semanal",
    amount: 200,
    dayAmount: 120,
    additionalAmount: 35,
  };
  const stored = encryptFields(caregiver, SECURE_FIELDS.caregivers, key, path);

  assert.equal(stored.id, "c1");
  assert.equal(stored.frequency, "Semanal");
  assert.ok(
    isEncryptedValue(stored.name) &&
      isEncryptedValue(stored.amount) &&
      isEncryptedValue(stored.additionalAmount),
  );
  assert.equal("nightAmount" in stored, false);

  const { data, hasPlaintext, hasLockedFields } = decryptFields(
    stored,
    SECURE_FIELDS.caregivers,
    key,
    path,
  );
  assert.deepEqual(data, caregiver);
  assert.equal(hasPlaintext, false);
  assert.equal(hasLockedFields, false);
});

test("financial rate snapshots in payment history are encrypted and lock with their record", () => {
  const historyPath = "houses/h1/paymentHistory/p1";
  const original = {
    caregiverName: "Ana",
    amount: 235,
    dayRate: 200,
    nightRate: 250,
    additionalRate: 35,
  };
  const stored = encryptFields(original, SECURE_FIELDS.paymentHistory, key, historyPath);
  for (const field of ["dayRate", "nightRate", "additionalRate"]) {
    assert.ok(isEncryptedValue(stored[field]));
  }
  assert.deepEqual(
    decryptFields(stored, SECURE_FIELDS.paymentHistory, key, historyPath).data,
    original,
  );
  const locked = decryptFields(
    stored,
    SECURE_FIELDS.paymentHistory,
    importDataKey(generateDataKey()),
    historyPath,
  );
  assert.equal(locked.hasLockedFields, true);
  assert.equal(locked.data.additionalRate, 0);
});

test("plain-text records from before encryption are read and flagged for migration", () => {
  const legacy = { id: "c1", name: "Ana", amount: 200 };
  const { data, hasPlaintext } = decryptFields(legacy, SECURE_FIELDS.caregivers, key, path);

  assert.deepEqual(data, legacy);
  assert.equal(hasPlaintext, true);
});

test("fields that fail to decrypt are masked instead of crashing", () => {
  const stored = encryptFields({ name: "Ana", amount: 200 }, SECURE_FIELDS.caregivers, key, path);
  const otherKey = importDataKey(generateDataKey());
  const { data, hasLockedFields } = decryptFields(stored, SECURE_FIELDS.caregivers, otherKey, path);

  assert.equal(hasLockedFields, true);
  assert.equal(data.amount, 0);
  assert.notEqual(data.name, "Ana");
});
