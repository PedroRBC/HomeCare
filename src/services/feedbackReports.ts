import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  doc,
  documentId,
  getDocsFromServer,
  getFirestore,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
} from "@react-native-firebase/firestore";
import { randomUUID } from "expo-crypto";
import {
  exportOwnReport as stripPrivateReportFields,
  makeReportContent,
  REPORTS_COLLECTION,
  REPORT_PAGE_SIZE,
  reportSchema,
  sameReportContent,
  type FeedbackReport,
  type ReportContext,
  type ReportDraft,
} from "@/feedback/report";

const reportsCollection = () => collection(getFirestore(), REPORTS_COLLECTION);
const reportDocument = (reportId: string) => doc(getFirestore(), REPORTS_COLLECTION, reportId);
const ensureCurrentUser = (expectedUid?: string) => {
  const uid = getAuth().currentUser?.uid;
  if (!uid || (expectedUid !== undefined && uid !== expectedUid)) {
    throw new Error("Feedback report belongs to a different or ended account session");
  }
  return uid;
};

function toIsoTimestamp(value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return (value.toDate() as Date).toISOString();
  }
  return value;
}

function parseStoredReport(id: string, data: Record<string, unknown>): FeedbackReport {
  return reportSchema.parse({
    ...data,
    id,
    createdAt: toIsoTimestamp(data.createdAt),
    updatedAt: toIsoTimestamp(data.updatedAt),
  });
}

/** Creates one online report, or safely acknowledges a retry with identical content. */
export async function submitFeedbackReport(
  draft: ReportDraft,
  context: ReportContext,
  reportId: string = randomUUID(),
  expectedUid?: string,
): Promise<string> {
  const uid = ensureCurrentUser(expectedUid);
  const content = makeReportContent(draft, uid, context);
  const ref = reportDocument(reportId);
  ensureCurrentUser(uid);

  await runTransaction(getFirestore(), async (transaction) => {
    ensureCurrentUser(uid);
    const existing = await transaction.get(ref);
    ensureCurrentUser(uid);
    if (existing.exists()) {
      if (sameReportContent(existing.data() as Record<string, unknown>, content)) return;
      throw new Error("A different feedback report already uses this reference");
    }
    transaction.set(ref, {
      ...content,
      status: "open",
      issueUrl: null,
      reviewerUid: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  ensureCurrentUser(uid);
  return reportId;
}

/** Lists all of the signed-in user's reports in bounded pages, with identities removed. */
export async function listOwnReports(userId: string): Promise<Record<string, unknown>[]> {
  ensureCurrentUser(userId);
  const results: Record<string, unknown>[] = [];
  let cursor: unknown;

  while (true) {
    ensureCurrentUser(userId);
    const pageQuery = query(
      reportsCollection(),
      where("reporterUid", "==", userId),
      orderBy(documentId()),
      limit(REPORT_PAGE_SIZE),
      ...(cursor ? [startAfter(cursor)] : []),
    );
    const page = await getDocsFromServer(pageQuery);
    ensureCurrentUser(userId);
    for (const snapshot of page.docs) {
      results.push(
        stripPrivateReportFields(
          parseStoredReport(snapshot.id, snapshot.data() as Record<string, unknown>),
        ),
      );
    }
    if (page.docs.length < REPORT_PAGE_SIZE) break;
    cursor = page.docs[page.docs.length - 1];
  }

  return results;
}

/** Deletes every report owned by the current account in bounded batches. */
export async function deleteOwnReports(userId: string): Promise<void> {
  ensureCurrentUser(userId);

  while (true) {
    ensureCurrentUser(userId);
    const page = await getDocsFromServer(
      query(
        reportsCollection(),
        where("reporterUid", "==", userId),
        orderBy(documentId()),
        limit(REPORT_PAGE_SIZE),
      ),
    );
    ensureCurrentUser(userId);
    if (page.empty) return;

    const batch = writeBatch(getFirestore());
    for (const snapshot of page.docs) batch.delete(snapshot.ref);
    ensureCurrentUser(userId);
    await batch.commit();
    ensureCurrentUser(userId);
  }
}
