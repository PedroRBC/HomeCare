import { decryptValue, encryptValue, isEncryptedValue } from "./fieldCrypto";

/**
 * Which fields of each stored record hold personal or financial data and are
 * encrypted before leaving the device.
 */
export const SECURE_FIELDS = {
  caregivers: ["name", "amount", "dayAmount", "nightAmount"],
  paymentHistory: ["caregiverName", "amount", "description", "managerName"],
} as const;

const LOCKED_TEXT = "🔒 Indisponível";

const fieldContext = (docPath: string, field: string) => `${docPath}#${field}`;

/** Returns a copy of `record` with the given fields encrypted. Undefined fields are left out. */
export function encryptFields<T extends Record<string, unknown>>(
  record: T,
  fields: readonly string[],
  key: Uint8Array,
  docPath: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...record };
  for (const field of fields) {
    const value = record[field];
    if (value === undefined || value === null) {
      delete result[field];
    } else if (typeof value === "string" || typeof value === "number") {
      result[field] = encryptValue(key, value, fieldContext(docPath, field));
    }
  }
  return result;
}

export type DecryptedRecord = {
  data: Record<string, unknown>;
  // Some fields were still stored in plain text (written before encryption existed)
  hasPlaintext: boolean;
  // Some fields could not be decrypted (wrong key or tampered data)
  hasLockedFields: boolean;
};

/**
 * Decrypts the given fields of a stored record. Plain-text values from before
 * encryption are passed through unchanged and reported, so they can be migrated.
 */
export function decryptFields(
  record: Record<string, unknown>,
  fields: readonly string[],
  key: Uint8Array,
  docPath: string,
): DecryptedRecord {
  const data: Record<string, unknown> = { ...record };
  let hasPlaintext = false;
  let hasLockedFields = false;

  for (const field of fields) {
    const value = record[field];
    if (value === undefined || value === null) continue;

    if (!isEncryptedValue(value)) {
      hasPlaintext = true;
      continue;
    }

    try {
      data[field] = decryptValue(key, value, fieldContext(docPath, field));
    } catch {
      hasLockedFields = true;
      data[field] = field.toLowerCase().includes("amount") ? 0 : LOCKED_TEXT;
    }
  }

  return { data, hasPlaintext, hasLockedFields };
}
