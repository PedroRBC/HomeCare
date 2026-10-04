import { doc, getDoc, getFirestore, runTransaction } from "@react-native-firebase/firestore";
import { generateDataKey, importDataKey } from "@/utils/fieldCrypto";

/**
 * Each house has its own 256-bit data key, used to encrypt the personal data of
 * its caregivers and payments. Only members of the house can read it (see
 * firestore.rules). Deleting it makes encrypted copies kept without the key (device
 * caches, partial exports) unreadable; a full database backup taken earlier also
 * holds the key and only goes away when that backup expires.
 */

const HOUSE_KEYS = "house_keys";
const cache = new Map<string, Uint8Array>();

type HouseKeyDocument = {
  key: string;
  version: number;
  createdAt: string;
  createdBy: string;
};

const keyRef = (houseId: string) => doc(getFirestore(), HOUSE_KEYS, houseId);

export const HouseKeyService = {
  keyRef,

  newKeyDocument(userId: string): HouseKeyDocument {
    return {
      key: generateDataKey(),
      version: 1,
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };
  },

  async getKey(houseId: string, userId: string): Promise<Uint8Array> {
    const cached = cache.get(houseId);
    if (cached) return cached;

    const snapshot = await getDoc(keyRef(houseId));
    let encodedKey = snapshot.exists() ? (snapshot.data() as HouseKeyDocument).key : undefined;

    // Houses created before encryption have no key yet. The transaction makes
    // sure two members opening the house at once end up with the same key.
    if (!encodedKey) {
      encodedKey = await runTransaction(getFirestore(), async (transaction) => {
        const current = await transaction.get(keyRef(houseId));
        if (current.exists()) return (current.data() as HouseKeyDocument).key;

        const created = HouseKeyService.newKeyDocument(userId);
        transaction.set(keyRef(houseId), created);
        return created.key;
      });
    }

    const key = importDataKey(encodedKey);
    cache.set(houseId, key);
    return key;
  },

  forget(houseId: string) {
    cache.delete(houseId);
  },

  clear() {
    cache.clear();
  },
};
