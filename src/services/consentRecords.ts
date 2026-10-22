import { FirestoreService } from "./firestore";
import { TelemetryService } from "./firebase";
import { ConsentStorageService } from "./consentStorage";
import { changedPurposes, type UserConsents, type TelemetryPreferences } from "@/utils/privacy";
import { createSerialQueue } from "@/utils/serialQueue";
import { logger } from "@/utils/logger";

type Ticket = Partial<Record<keyof TelemetryPreferences, number>>;
const queues = new Map<
  string,
  { enqueue: ReturnType<typeof createSerialQueue>; pending: number }
>();

// Order includes ticket lookup and recording, not just the final Firestore call.
// A delayed startup replay cannot land after a newer choice for the same account.
export const ConsentRecordService = {
  record(
    userId: string,
    changes: UserConsents,
    isCurrent: () => boolean,
    ticket?: Ticket,
  ): Promise<void> {
    let queue = queues.get(userId);
    if (!queue) {
      queue = { enqueue: createSerialQueue(), pending: 0 };
      queues.set(userId, queue);
    }
    const currentQueue = queue;
    currentQueue.pending++;
    return currentQueue.enqueue(async () => {
      try {
        if (!isCurrent()) throw new Error("This consent record belongs to an ended session");
        const expected = ticket ?? (await TelemetryService.pendingRevocationTicket(userId));
        if (!isCurrent()) throw new Error("This consent record belongs to an ended session");
        await FirestoreService.updateUserConsents(userId, changes);
        if (!isCurrent()) return;
        await ConsentStorageService.remember(userId, changes, isCurrent);
        if (!isCurrent()) return;
        await ConsentStorageService.acknowledge(isCurrent, () =>
          TelemetryService.clearPendingRevocation(userId, changedPurposes(changes), expected),
        ).catch((error) => logger.warn("Clearing a recorded telemetry revocation failed:", error));
      } finally {
        currentQueue.pending--;
        if (!currentQueue.pending && queues.get(userId) === currentQueue) queues.delete(userId);
      }
    });
  },
};
