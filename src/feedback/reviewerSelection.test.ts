import { test } from "node:test";
import assert from "node:assert/strict";
import { findInboxSelection, isSameInboxNavigation } from "./reviewerSelection";

const reports = [{ id: "report-a" }, { id: "report-b" }];
const navigation = { loadGeneration: 1, selectionGeneration: 1 };

test("a report saved out of the active filter is not restored as a selection", () => {
  const refreshed = reports.filter((report) => report.id !== "report-a");
  const selectedId = findInboxSelection(refreshed, "report-a")?.id ?? null;
  assert.equal(selectedId, null);
  assert.equal(Boolean(findInboxSelection(refreshed, selectedId)), false);
});

test("a saved report still in the refreshed results remains selectable", () => {
  assert.equal(findInboxSelection(reports, "report-a"), reports[0]);
});

test("a stale selection cannot activate the narrow-screen detail layout", () => {
  assert.equal(Boolean(findInboxSelection(reports, "missing-report")), false);
  assert.equal(Boolean(findInboxSelection(reports, null)), false);
  assert.equal(Boolean(findInboxSelection([], "report-a")), false);
});

test("an unchanged navigation allows the save to refresh and restore a valid report", () => {
  assert.equal(isSameInboxNavigation(navigation, { ...navigation }), true);
});

test("selecting another report or returning to the inbox prevents save restoration", () => {
  assert.equal(isSameInboxNavigation(navigation, { ...navigation, selectionGeneration: 2 }), false);
});

test("navigating away and back to the same report still invalidates the pending save", () => {
  assert.equal(isSameInboxNavigation(navigation, { ...navigation, selectionGeneration: 3 }), false);
});

test("changing filters, paging, or refreshing invalidates the pending save navigation", () => {
  assert.equal(isSameInboxNavigation(navigation, { ...navigation, loadGeneration: 2 }), false);
});

test("navigation during the post-save refresh also prevents selection restoration", () => {
  const refreshNavigation = { ...navigation, loadGeneration: 2 };
  assert.equal(isSameInboxNavigation(refreshNavigation, { ...refreshNavigation }), true);
  assert.equal(
    isSameInboxNavigation(refreshNavigation, { ...refreshNavigation, selectionGeneration: 2 }),
    false,
  );
  assert.equal(
    isSameInboxNavigation(refreshNavigation, { ...refreshNavigation, loadGeneration: 3 }),
    false,
  );
});
