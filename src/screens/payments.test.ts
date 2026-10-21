import { test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { createRenderer, installNativeRuntime, nodes } from "../test/native";
installNativeRuntime();
let failed = false;
const alerts: any[] = [];
const failure = new Error("permission denied");
const state = {
  caregivers: [],
  paymentHistory: [],
  hasLoadError: false,
  isFirestoreConnected: true,
  retryLoad: () => {},
  markPaidForPeriod: async () => {
    if (failed) throw failure;
  },
};
mock.module("@/context/ScheduleContext", () => ({ useSchedule: () => state }));
mock.module("@/context/HouseContext", () => ({
  useHouse: () => ({ currentHouse: { name: "Demo" } }),
}));
mock.module("@/context/AlertContext", () => ({
  useAlert: () => ({ showAlert: (alert: any) => alerts.push(alert) }),
}));
mock.module("@/hooks/useUpcomingPayments", () => ({
  useUpcomingPayments: () => [
    {
      id: "one",
      caregiverId: "ana",
      caregiver: "Ana",
      periodKey: "2026-10-21",
      frequency: "Diário",
      amount: 10,
      date: new Date(2026, 9, 21),
    },
  ],
}));
mock.module("@/hooks/useRateApp", () => ({
  useRateApp: () => ({ incrementActionCount: () => {} }),
}));
mock.module("@/services/exportService", () => ({
  exportPaymentHistoryExcel: async () => {},
  exportPaymentHistoryPDF: async () => {},
}));
const { PaymentsScreen } = await import("./payments");
const { HistoryScreen } = await import("./history");

test("a rejected payment reaches the list as rejection after the error alert", async () => {
  failed = true;
  state.hasLoadError = false;
  const renderer = createRenderer();
  const tree = renderer.render(PaymentsScreen);
  const list = nodes(tree).find((node) => node.props.onMarkPaid);
  assert.ok(list);
  await assert.rejects(
    list.props.onMarkPaid({ caregiverId: "ana", periodKey: "today", frequency: "Diário" }),
    failure,
  );
  assert.equal(alerts.at(-1).message, "payments.registerError");
  renderer.unmount();
});

test("unavailable payment and history data exposes retry instead of reassuring empty content", () => {
  state.hasLoadError = true;
  state.isFirestoreConnected = false;
  for (const screen of [PaymentsScreen, HistoryScreen]) {
    const renderer = createRenderer();
    const tree = renderer.render(screen);
    assert.ok(nodes(tree).some((node) => node.props.onRetry === state.retryLoad));
    assert.equal(
      nodes(tree).some((node) => node.props.onMarkPaid || node.props.title === "history.noneFound"),
      false,
    );
    renderer.unmount();
  }
});
