export type InboxNavigation = {
  loadGeneration: number;
  selectionGeneration: number;
};

export function isSameInboxNavigation(
  expected: InboxNavigation,
  current: InboxNavigation,
): boolean {
  return (
    expected.loadGeneration === current.loadGeneration &&
    expected.selectionGeneration === current.selectionGeneration
  );
}

export function findInboxSelection<T extends { id: string }>(
  reports: readonly T[],
  selectedId: string | null,
): T | undefined {
  return reports.find((report) => report.id === selectedId);
}
