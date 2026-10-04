import { getRandomValues } from "expo-crypto";

// Hermes has no Web Crypto, so expose the native secure generator as
// crypto.getRandomValues for the encryption code (see utils/fieldCrypto.ts).
const globalScope = globalThis as { crypto?: { getRandomValues?: unknown } };

if (typeof globalScope.crypto?.getRandomValues !== "function") {
  globalScope.crypto = { ...(globalScope.crypto ?? {}), getRandomValues };
}
