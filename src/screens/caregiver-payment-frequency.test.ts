import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import React from "react";
import { init, t } from "i18next";
import pt from "@/i18n/locales/pt";
import type { Caregiver } from "@/context/ScheduleContext";

const caregiver: Caregiver = {
  id: "maria",
  name: "Maria",
  frequency: "Semanal",
  amount: 250,
  dayAmount: 100,
  nightAmount: 150,
};
let state: unknown[];
let cursor: number;
let effects: (() => void)[];
let saved: Partial<Caregiver>[];

// Bun has no native hosts or hook renderer. Keep the screens, translations,
// validation and submit handlers real; replace platform hooks and persistence.
const useState = (initial: unknown) => {
  const index = cursor++;
  if (!(index in state)) state[index] = initial;
  return [state[index], (value: unknown) => (state[index] = value)];
};
mock.module("react", () => ({
  ...React,
  useState,
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => void) => effects.push(effect),
}));
mock.module("react-native", () => ({
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "android" },
}));
mock.module("@/theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
mock.module("@/context/ScheduleContext", () => ({
  useSchedule: () => ({
    caregivers: [caregiver],
    addCaregiver: async (value: Partial<Caregiver>) => saved.push(value),
    updateCaregiver: async (value: Caregiver) => saved.push(value),
  }),
}));
mock.module("@/context/AlertContext", () => ({
  useAlert: () => ({ showAlert: () => {} }),
}));
mock.module("@react-navigation/native", () => ({
  useRoute: () => ({ params: { caregiverId: "maria" } }),
  useNavigation: () => ({ goBack: () => {} }),
}));
mock.module("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0 }),
}));
mock.module("@/hooks/useFirebase", () => ({ useScreenTracking: () => {} }));
mock.module("@/hooks/useCaregiverLinks", () => ({ useHouseCaregiverLinks: () => ({}) }));
mock.module("@/services/firestore", () => ({ FirestoreService: {} }));
mock.module("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }));
mock.module("react-i18next", () => ({ useTranslation: () => ({ t }) }));
const { CreateScreen } = await import("./create");
const { EditCaregiverScreen } = await import("./edit-caregiver");

type Element = React.ReactElement<{
  children?: React.ReactNode;
  placeholder?: string;
  onChangeText?: (value: string) => void;
  onPress?: () => Promise<void> | void;
  disabled?: boolean;
}>;
function elements(node: React.ReactNode): Element[] {
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
function render(screen: () => React.ReactNode) {
  cursor = 0;
  effects = [];
  return elements(screen());
}
function button(tree: Element[], label: string) {
  return tree.find(
    (element) =>
      element.type === ("Pressable" as unknown) &&
      elements(element).some((child) => child.props.children === label),
  );
}

beforeEach(async () => {
  await init({ lng: "pt", resources: { pt: { translation: pt } } });
  state = [];
  saved = [];
});

for (const [name, screen] of [
  ["create", CreateScreen],
  ["edit", EditCaregiverScreen],
] as const) {
  test(`${name}: daily payment can be selected and saved alongside the existing frequencies`, async () => {
    let tree = render(screen);
    if (name === "edit") {
      effects.forEach((effect) => effect());
    } else {
      for (const [placeholder, value] of [
        [pt.create.namePlaceholder, "Ana"],
        [pt.create.dayPlaceholder, "100"],
        [pt.create.nightPlaceholder, "150"],
      ]) {
        tree.find((element) => element.props.placeholder === placeholder)!.props.onChangeText!(
          value,
        );
      }
    }
    tree = render(screen);
    const labels = ["Diária", "Semanal", "Quinzena", "Mensal"];
    const frequencyLabels = tree
      .filter((element) => element.type === ("Pressable" as unknown))
      .flatMap((element) => elements(element).map((child) => child.props.children))
      .filter((label) => typeof label === "string" && [...labels, "Único"].includes(label));
    assert.deepEqual(frequencyLabels, labels);
    await button(tree, "Diária")!.props.onPress!();
    tree = render(screen);
    const submit = button(tree, name === "create" ? pt.create.save : pt.caregivers.edit.save)!;
    assert.equal(submit.props.disabled, false);
    await submit.props.onPress!();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].frequency, "Diário");
    assert.equal(saved[0].dayAmount, 100);
    assert.equal(saved[0].nightAmount, 150);
  });
}
