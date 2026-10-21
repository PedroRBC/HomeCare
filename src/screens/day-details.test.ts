import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import React from "react";
import { init, t } from "i18next";
import pt from "@/i18n/locales/pt";
import type { Caregiver, ShiftType } from "@/context/ScheduleContext";

const caregiver: Caregiver = {
  id: "maria",
  name: "Maria",
  frequency: "Semanal",
  amount: 100,
  email: "maria@example.com",
};
let caregivers: Caregiver[] = [];
let assignments: [string, Date, ShiftType][] = [];
let alerts: { message: string }[] = [];
let scheduled: Partial<Record<ShiftType, Caregiver[]>> = {};
let extras: Partial<Record<ShiftType, Caregiver[]>> = {};
let saveError: Error | undefined;

// Native hosts and hook providers are unavailable in Bun; keep the screen's
// render, availability hook, translations and press handlers real.
mock.module("react", () => ({
  ...React,
  default: { ...React, useEffect: () => {} },
  useMemo: (factory: () => unknown) => factory(),
}));
mock.module("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
}));
mock.module("@/theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
mock.module("@react-navigation/native", () => ({
  useRoute: () => ({ params: { date: "2026-10-21" } }),
  useNavigation: () => ({}),
}));
mock.module("@/context/ScheduleContext", () => ({
  useSchedule: () => ({
    caregivers,
    getScheduledCaregivers: (_date: Date, shift: ShiftType) => scheduled[shift] ?? [],
    getExtraScheduledCaregivers: (_date: Date, shift: ShiftType) => extras[shift] ?? [],
    getAdditionalScheduledCaregivers: () => [],
    isPaidForCaregiverShift: () => false,
    toggleShiftAssignment: async (id: string, date: Date, shift: ShiftType) => {
      if (saveError) throw saveError;
      assignments.push([id, date, shift]);
    },
  }),
}));
mock.module("@/context/AlertContext", () => ({
  useAlert: () => ({ showAlert: (alert: { message: string }) => alerts.push(alert) }),
}));
mock.module("@/context/HouseContext", () => ({ useHouse: () => ({}) }));
mock.module("@/services/firestore", () => ({ FirestoreService: {} }));
mock.module("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
mock.module("@/hooks/useFirebase", () => ({ useScreenTracking: () => {} }));
mock.module("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
const gesture = {
  activeOffsetX: () => gesture,
  failOffsetY: () => gesture,
  onUpdate: () => gesture,
  onEnd: () => gesture,
};
mock.module("react-native-gesture-handler", () => ({
  Gesture: { Pan: () => gesture },
  GestureDetector: "GestureDetector",
}));
mock.module("react-native-reanimated", () => ({
  default: { View: "AnimatedView" },
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: (factory: () => unknown) => factory(),
  withSpring: (value: number) => value,
  runOnJS: (callback: unknown) => callback,
}));
mock.module("react-i18next", () => ({ useTranslation: () => ({ t }) }));
const { DayDetailsScreen } = await import("./day-details");

type Element = React.ReactElement<{
  children?: React.ReactNode;
  testID?: string;
  onPress?: () => Promise<void>;
  disabled?: boolean;
}>;
function elements(node: React.ReactNode): Element[] {
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
function shiftButtons(tree: Element[]) {
  return tree
    .filter((element) =>
      React.Children.toArray(element.props.children).some((child) =>
        elements(child).some(
          (descendant) =>
            descendant.props.children === pt.dayDetails.dayShift ||
            descendant.props.children === pt.dayDetails.nightShift,
        ),
      ),
    )
    .filter((element) => element.type === ("Pressable" as unknown));
}

beforeEach(async () => {
  await init({ lng: "pt", resources: { pt: { translation: pt } } });
  caregivers = [caregiver];
  assignments = [];
  alerts = [];
  scheduled = {};
  extras = {};
  saveError = undefined;
});

for (const [index, shift] of (["day", "night"] as const).entries()) {
  test(`selecting an emailed caregiver for the ${shift} shift saves without a confirmation modal`, async () => {
    const tree = elements(DayDetailsScreen());
    assert.equal(
      tree.filter((element) => element.props.testID === "availability-unknown").length,
      1,
    );
    const pending = shiftButtons(tree)[index].props.onPress!();
    await Promise.resolve();
    assert.equal(alerts.length, 0);
    await pending;
    assert.equal(assignments.length, 1);
    assert.equal(assignments[0][0], "maria");
    assert.equal(assignments[0][1].getDate(), 21);
    assert.equal(assignments[0][2], shift);
  });
}

test("the list shows one availability note even with several emailed caregivers", () => {
  caregivers.push({ ...caregiver, id: "ana", name: "Ana", email: "ana@example.com" });
  const tree = elements(DayDetailsScreen());
  assert.equal(tree.filter((element) => element.props.testID === "availability-unknown").length, 1);
  assert.equal(
    tree.filter((element) => element.props.children === pt.caregiverView.availabilityUnknown)
      .length,
    1,
  );
});

test("no availability note is shown for absent emails, blank emails or disabled caregivers", () => {
  caregivers = [
    { ...caregiver, email: undefined },
    { ...caregiver, id: "blank", email: "  " },
    { ...caregiver, id: "disabled", disabled: true },
  ];
  assert.equal(
    elements(DayDetailsScreen()).some((element) => element.props.testID === "availability-unknown"),
    false,
  );
});

test("removing an existing shift does not ask for confirmation", async () => {
  scheduled.day = [caregiver];
  await shiftButtons(elements(DayDetailsScreen()))[0].props.onPress!();
  assert.equal(assignments.length, 1);
  assert.equal(alerts.length, 0);
});

test("disabled caregivers cannot be selected", async () => {
  caregivers = [{ ...caregiver, disabled: true }];
  const button = shiftButtons(elements(DayDetailsScreen()))[0];
  assert.equal(button.props.disabled, true);
  await button.props.onPress!();
  assert.equal(assignments.length, 0);
  assert.equal(alerts.length, 0);
});

test("legacy extra-only shifts retain their explanation instead of saving a regular shift", async () => {
  extras.day = [caregiver];
  await shiftButtons(elements(DayDetailsScreen()))[0].props.onPress!();
  assert.equal(assignments.length, 0);
  assert.equal(alerts[0].message, pt.dayDetails.legacyExtraMessage);
});

test("save failures still show an error rather than silently losing the selection", async () => {
  scheduled.day = [caregiver];
  saveError = new Error("Save failed");
  const originalError = console.error;
  console.error = () => {};
  try {
    await shiftButtons(elements(DayDetailsScreen()))[0].props.onPress!();
  } finally {
    console.error = originalError;
  }
  assert.equal(assignments.length, 0);
  assert.equal(alerts[0].message, pt.dayDetails.toggleError);
});
