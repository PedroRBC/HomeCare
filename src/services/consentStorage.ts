import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";
import type { UserConsents } from "@/utils/privacy";
import { createSerialQueue } from "@/utils/serialQueue";
import { logger } from "@/utils/logger";

const policy = z.object({ version: z.string().min(1), acceptedAt: z.iso.datetime() });
const choice = z.object({ granted: z.boolean(), updatedAt: z.iso.datetime() });
const storedConsents = z.object({
  privacyPolicy: policy.optional(),
  terms: policy.optional(),
  analytics: choice.optional(),
  crashReports: choice.optional(),
});
// Account-scoped and independent of app/build versions; removed by account deletion's storage cleanup.
const keyFor = (uid: string) => `@homecare:consents.${uid}`;
const enqueue = createSerialQueue();

async function read(uid: string): Promise<UserConsents | undefined> {
  const stored = await AsyncStorage.getItem(keyFor(uid));
  if (!stored) return undefined;
  return storedConsents.parse(JSON.parse(stored));
}

export const ConsentStorageService = {
  // Revocation acknowledgements also write device data and share deletion's barrier.
  acknowledge(isCurrent: () => boolean, record: () => Promise<void>): Promise<void> {
    return enqueue(async () => {
      if (isCurrent()) await record();
    });
  },

  // Drain writes already in flight before account deletion clears device data.
  clearDeviceData(isCurrent: () => boolean): Promise<void> {
    return enqueue(async () => {
      if (isCurrent()) await AsyncStorage.clear();
    });
  },

  load(uid: string): Promise<UserConsents | undefined> {
    return enqueue(async () => {
      try {
        return await read(uid);
      } catch {
        logger.warn("Local consent record could not be loaded");
        return undefined;
      }
    });
  },

  remember(uid: string, changes: UserConsents, isCurrent = () => true): Promise<void> {
    return enqueue(async () => {
      if (!isCurrent()) return;
      try {
        // A damaged cache must not prevent replacing it with a valid account record.
        const previous = await read(uid).catch(() => undefined);
        if (!isCurrent()) return;
        const consents = storedConsents.parse({ ...previous, ...changes });
        await AsyncStorage.setItem(keyFor(uid), JSON.stringify(consents));
      } catch {
        // Firestore remains authoritative if this device cannot save a local copy.
        logger.warn("Local consent record could not be saved");
      }
    });
  },
};
