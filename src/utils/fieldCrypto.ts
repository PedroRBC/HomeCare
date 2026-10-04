import { gcm } from "@noble/ciphers/aes.js";
import { bytesToUtf8, utf8ToBytes } from "@noble/ciphers/utils.js";

/**
 * Field-level encryption (AES-256-GCM) for personal data stored in the database.
 *
 * Encrypted values are strings shaped as `enc:v1:<base64(nonce | ciphertext | tag)>`.
 * Each value is bound to its location (document path + field name) through the
 * GCM additional data, so a ciphertext copied to another field or document fails
 * to decrypt instead of silently showing the wrong data.
 */

export const ENCRYPTED_PREFIX = "enc:v1:";
const KEY_BYTES = 32;
const NONCE_BYTES = 12;

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP = new Map([...BASE64_ALPHABET].map((char, index) => [char, index]));

export function bytesToBase64(bytes: Uint8Array): string {
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    output += BASE64_ALPHABET[(chunk >> 18) & 63] + BASE64_ALPHABET[(chunk >> 12) & 63];
    output += i + 1 < bytes.length ? BASE64_ALPHABET[(chunk >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? BASE64_ALPHABET[chunk & 63] : "=";
  }
  return output;
}

export function base64ToBytes(value: string): Uint8Array {
  if (value.length % 4 !== 0) throw new Error("Invalid base64 length");
  const clean = value.replace(/=+$/, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    const sextet = BASE64_LOOKUP.get(char);
    if (sextet === undefined) throw new Error("Invalid base64 character");
    buffer = (buffer << 6) | sextet;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => void } })
    .crypto;
  if (typeof cryptoApi?.getRandomValues !== "function") {
    // Never fall back to Math.random: a predictable nonce or key breaks AES-GCM
    throw new Error("Secure random generator unavailable");
  }
  const bytes = new Uint8Array(length);
  cryptoApi.getRandomValues(bytes);
  return bytes;
}

/** Generates a new 256-bit data key, base64 encoded for storage. */
export function generateDataKey(): string {
  return bytesToBase64(randomBytes(KEY_BYTES));
}

export function importDataKey(encoded: string): Uint8Array {
  const key = base64ToBytes(encoded);
  if (key.length !== KEY_BYTES) throw new Error("Invalid data key");
  return key;
}

export function isEncryptedValue(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(ENCRYPTED_PREFIX);
}

export function encryptValue(key: Uint8Array, value: string | number, context: string): string {
  const nonce = randomBytes(NONCE_BYTES);
  const sealed = gcm(key, nonce, utf8ToBytes(context)).encrypt(utf8ToBytes(JSON.stringify(value)));
  const payload = new Uint8Array(nonce.length + sealed.length);
  payload.set(nonce);
  payload.set(sealed, nonce.length);
  return ENCRYPTED_PREFIX + bytesToBase64(payload);
}

/** Decrypts a value produced by `encryptValue`. Throws if the key, context or data don't match. */
export function decryptValue(key: Uint8Array, value: string, context: string): string | number {
  if (!isEncryptedValue(value)) throw new Error("Value is not encrypted");
  const payload = base64ToBytes(value.slice(ENCRYPTED_PREFIX.length));
  const nonce = payload.subarray(0, NONCE_BYTES);
  const sealed = payload.subarray(NONCE_BYTES);
  const plain = JSON.parse(bytesToUtf8(gcm(key, nonce, utf8ToBytes(context)).decrypt(sealed)));
  if (typeof plain !== "string" && typeof plain !== "number") {
    throw new Error("Unexpected decrypted value");
  }
  return plain;
}
