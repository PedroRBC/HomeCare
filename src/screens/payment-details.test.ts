import { test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { createRenderer, installNativeRuntime, nodes, text } from "../test/native";
installNativeRuntime();
let deleted = 0;
const alerts: any[] = [];
mock.module("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: () => {} }),
  useRoute: () => ({
    params: {
      payment: {
        id: "one",
        caregiverId: "ana",
        caregiverName: "Ana",
        frequency: "Diário",
        amount: 180,
        description: "Day",
        paidAt: "2026-10-21T12:00:00Z",
        paymentKeys: [],
      },
    },
  }),
}));
mock.module("@/context/ScheduleContext", () => ({
  useSchedule: () => ({
    caregivers: [],
    scheduleByDay: {},
    deletePaymentHistory: async () => {
      deleted++;
    },
  }),
}));
mock.module("@/context/AlertContext", () => ({
  useAlert: () => ({ showAlert: (alert: any) => alerts.push(alert) }),
}));
const { PaymentDetailsScreen } = await import("./payment-details");

test("secondary payment deletion remains named and requires explicit confirmation", async () => {
  const renderer = createRenderer();
  const tree = renderer.render(PaymentDetailsScreen);
  const control = nodes(tree).find(
    (node) => node.type === "Pressable" && text(node).includes("paymentDetails.delete"),
  )!;
  assert.equal(control.props.accessibilityRole, "button");
  await control.props.onPress();
  assert.equal(deleted, 0);
  const confirmation = alerts.at(-1);
  assert.equal(confirmation.buttons[0].style, "cancel");
  await confirmation.buttons[1].onPress();
  assert.equal(deleted, 1);
  renderer.unmount();
});

test("payment detail content can scroll as a whole so long content cannot hide actions", () => {
  const renderer = createRenderer();
  const tree = renderer.render(PaymentDetailsScreen);
  const fullScroll = nodes(tree).find(
    (node) => node.type === "ScrollView" && text(node).includes("paymentDetails.delete"),
  );
  assert.ok(fullScroll);
  renderer.unmount();
});
