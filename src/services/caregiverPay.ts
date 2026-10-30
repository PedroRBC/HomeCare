import { doc, getDoc, getFirestore, runTransaction } from "@react-native-firebase/firestore";
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

  // Writes only when the pay changed; null clears it from the link. `email` is the
  // link's email the pay was computed for: one transaction reads the link and its
  // key, so a pay computed before the link moved to a new email is never written.
  async sync(
    linkId: string,
    email: string,
    userId: string,
    pay: CaregiverPay | null,
  ): Promise<void> {
    const linkRef = doc(getFirestore(), LINKS, linkId);
    await runTransaction(getFirestore(), async (transaction) => {
      const link = await transaction.get(linkRef);
      const keyDoc = await transaction.get(keyRef(linkId));
      const current = link.data() as { email?: string; pay?: string | null } | undefined;
      if (current?.email !== email) return;
      if (!pay) {
        if (current.pay) transaction.update(linkRef, { pay: null });
        return;
      }

      // Two managers saving at once end up with the same key
      let encoded = keyDoc.exists() ? (keyDoc.data() as { key: string }).key : undefined;
      if (!encoded) {
        encoded = generateDataKey();
        transaction.set(keyRef(linkId), {
          key: encoded,
          createdAt: new Date().toISOString(),
          createdBy: userId,
        });
      }
      const key = importDataKey(encoded);
      const plain = JSON.stringify(pay);
      if (current.pay) {
        try {
          if (decryptValue(key, current.pay, context(linkId)) === plain) return;
        } catch {
          // Encrypted under a key that was rotated: write it again
        }
      }
      transaction.update(linkRef, { pay: encryptValue(key, plain, context(linkId)) });
    });
  },
};
