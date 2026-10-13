import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  exportOwnReport,
  formatReportForChat,
  issueUrlSchema,
  makeReportContent,
  reportContextSchema,
  reportDraftSchema,
  reportSchema,
  sameReportContent,
  type ReportDraft,
} from "./report";

const draft: ReportDraft = {
  type: "bug",
  title: "Keyboard hides submit",
  description: "The keyboard covers the submit button.",
  steps: "Open the form",
  expected: "Visible button",
  actual: "Hidden button",
};
const context = {
  appVersion: null,
  appBuild: null,
  platform: "android",
  osVersion: "15",
  language: "pt",
};
const content = makeReportContent(draft, "private-author", context);
const report = reportSchema.parse({
  ...content,
  id: "report-123",
  status: "open",
  issueUrl: null,
  reviewerUid: "private-reviewer",
  createdAt: "2026-10-13T12:00:00.000Z",
  updatedAt: "2026-10-13T12:00:00.000Z",
});

describe("feedback report contract", () => {
  test("trims text and drops hidden bug fields when sending feedback", () => {
    assert.deepEqual(
      reportDraftSchema.parse({ ...draft, type: "feedback", title: "  Helpful app  " }),
      { ...draft, type: "feedback", title: "Helpful app", steps: "", expected: "", actual: "" },
    );
  });
  test("rejects blank, short, oversized and unexpected fields", () => {
    for (const changes of [
      { title: "   " },
      { title: "ab" },
      { title: "a".repeat(121) },
      { description: "  short  " },
      { description: "a".repeat(5001) },
      { steps: "a".repeat(3001) },
      { expected: "a".repeat(2001) },
      { actual: "a".repeat(2001) },
      { token: "secret" },
    ]) {
      assert.equal(reportDraftSchema.safeParse({ ...draft, ...changes }).success, false);
    }
  });
  test("bug detail fields are optional to fill; versions may be unavailable", () => {
    assert.equal(
      reportDraftSchema.safeParse({ ...draft, steps: "", expected: "", actual: "" }).success,
      true,
    );
    assert.equal(reportContextSchema.safeParse(context).success, true);
    assert.equal(
      reportContextSchema.safeParse({ ...context, email: "private@example.com" }).success,
      false,
    );
    assert.equal(
      reportContextSchema.safeParse({ ...context, platform: "x".repeat(31) }).success,
      false,
    );
  });
  test("idempotency compares normalized content, not triage or property order", () => {
    assert.equal(
      sameReportContent(
        {
          ...report,
          context: {
            language: "pt",
            platform: "android",
            osVersion: "15",
            appBuild: null,
            appVersion: null,
          },
          status: "resolved",
        },
        content,
      ),
      true,
    );
    assert.equal(
      sameReportContent({ ...report, description: "A different report description" }, content),
      false,
    );
    assert.equal(sameReportContent({ ...report, reporterUid: "another-user" }, content), false);
    assert.equal(
      sameReportContent({ ...report, context: { ...context, token: "hidden" } }, content),
      false,
    );
  });
  test("issue links only accept canonical HTTPS GitHub issues", () => {
    assert.equal(
      issueUrlSchema.parse("https://github.com/pedrorbc/homecare/issues/12"),
      "https://github.com/pedrorbc/homecare/issues/12",
    );
    assert.equal(issueUrlSchema.parse(null), null);
    for (const value of [
      "javascript:alert(1)",
      "https://github.com.evil.test/a/b/issues/1",
      "https://github.com/a/b/pull/1",
      "https://github.com/a/b/issues/0",
      "https://github.com/a/b/issues/1?token=secret",
      "https://user@github.com/a/b/issues/1",
      "https://github.com/a/b/issues/1\n",
    ]) {
      assert.equal(issueUrlSchema.safeParse(value).success, false);
    }
  });
  test("chat copy includes actionable details, but not internal identity or timestamps", () => {
    const text = formatReportForChat(report);
    for (const value of [
      "Report reference: report-123",
      "Steps to reproduce:\nOpen the form",
      "App: unknown",
      "untrusted user data",
    ])
      assert.ok(text.includes(value));
    for (const secret of [
      report.reporterUid,
      report.reviewerUid!,
      report.createdAt,
      "reporterUid",
      "reviewerUid",
    ])
      assert.ok(!text.includes(secret));
    const feedback = formatReportForChat({
      ...report,
      type: "feedback",
      issueUrl: "https://github.com/pedrorbc/homecare/issues/1",
    });
    assert.ok(!feedback.includes("Steps to reproduce"));
    assert.ok(feedback.includes("Existing issue: https://github.com/pedrorbc/homecare/issues/1"));
  });
  test("personal export removes internal identities without losing submitted text", () => {
    const exported = exportOwnReport(report);
    assert.equal("reporterUid" in exported, false);
    assert.equal("reviewerUid" in exported, false);
    assert.equal(exported.description, draft.description);
    assert.equal(exported.createdAt, report.createdAt);
  });
});
