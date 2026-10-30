import {
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  updateDoc,
} from "@react-native-firebase/firestore";
import { decryptValue, encryptValue, generateDataKey, importDataKey } from "@/utils/fieldCrypto";
import { parseCaregiverPay, type CaregiverPay } from "@/utils/caregiverPay";

/**
 * Each caregiver link has its own 256-bit data key, so the caregiver can read her
 * own pay without ever getting the house key. Only the house's managers and the
 * caregiver, once she accepted, can read it (see firestore.rules). A new email on
 * the link deletes the key, so a previous caregiver can't read the next one's pay.
 */

const LINK_KEYS = "caregiver_link_keys";
const LINKS = "caregiver_links";

const keyRef = (linkId: string) => doc(getFirestore(), LINK_KEYS, linkId);
// Binds the ciphertext to this link and field (see fieldCrypto.ts)
const context = (linkId: string) => `${LINKS}/${linkId}/pay`;

async function readKey(linkId: string) {
  const snapshot = await getDoc(keyRef(linkId));
  return snapshot.exists() ? importDataKey((snapshot.data() as { key: string }).key) : null;
}

// Two managers saving at once end up with the same key
async function getOrCreateKey(linkId: string, userId: string) {
  const existing = await readKey(linkId);
  if (existing) return existing;
  const encoded = await runTransaction(getFirestore(), async (transaction) => {
    const current = await transaction.get(keyRef(linkId));
    if (current.exists()) return (current.data() as { key: string }).key;
    const created = {
      key: generateDataKey(),
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };
    transaction.set(keyRef(linkId), created);
    return created.key;
  });
  return importDataKey(encoded);
}

export const CaregiverPayService = {
  keyRef,

  // Null when there is no pay yet, the key can't be read or the data doesn't check out
  async read(linkId: string, encrypted: string | null | undefined): Promise<CaregiverPay | null> {
    if (!encrypted) return null;
    try {
      const key = await readKey(linkId);
      return key ? parseCaregiverPay(String(decryptValue(key, encrypted, context(linkId)))) : null;
    } catch {
      return null;
    }
  },

  // Writes only when the pay changed; null clears it from the link
  async sync(
    linkId: string,
    userId: string,
    encrypted: string | null | undefined,
    pay: CaregiverPay | null,
  ): Promise<void> {
    const linkRef = doc(getFirestore(), LINKS, linkId);
    if (!pay) {
      if (encrypted) await updateDoc(linkRef, { pay: null });
      return;
    }
    const key = await getOrCreateKey(linkId, userId);
    const plain = JSON.stringify(pay);
    if (encrypted) {
      try {
        if (decryptValue(key, encrypted, context(linkId)) === plain) return;
      } catch {
        // Encrypted under a key that was rotated: write it again
      }
    }
    await updateDoc(linkRef, { pay: encryptValue(key, plain, context(linkId)) });
  },
};
