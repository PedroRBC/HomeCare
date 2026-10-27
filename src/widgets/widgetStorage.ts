import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import { renderHomeWidget, WIDGET_NAMES } from "./HomeWidgets";
import type { WidgetSnapshot } from "./widgetData";

const SNAPSHOT_KEY = "@homecare/widget-snapshot";
const SHOW_AMOUNTS_KEY = "@homecare/widget-show-amounts";

export async function readWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const stored = await AsyncStorage.getItem(SNAPSHOT_KEY);
    return stored ? (JSON.parse(stored) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}

/** `keepStoredHouse`: refresh labels/colors but keep the house already shown. */
export async function publishWidgetSnapshot(snapshot: WidgetSnapshot, keepStoredHouse = false) {
  if (Platform.OS !== "android") return;
  if (keepStoredHouse) {
    const house = (await readWidgetSnapshot())?.house ?? null;
    // Turning amounts off must hide them at once, even with no house selected.
    const payments = house?.payments.map(({ amount, ...payment }) =>
      showAmounts ? { ...payment, amount } : payment,
    );
    snapshot = { ...snapshot, house: house && { ...house, payments: payments! } };
  }
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  await Promise.all(
    WIDGET_NAMES.map((widgetName) =>
      requestWidgetUpdate({
        widgetName,
        renderWidget: () => renderHomeWidget(widgetName, snapshot),
      }),
    ),
  );
}

// Opt-in shared by Settings and the sync hook; amounts stay off the home screen by default.
let showAmounts = false;
const listeners = new Set<() => void>();
void AsyncStorage.getItem(SHOW_AMOUNTS_KEY)
  .then((stored) => {
    showAmounts = stored === "true";
    listeners.forEach((listener) => listener());
  })
  .catch(() => {});

export const widgetAmounts = {
  get: () => showAmounts,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  set: async (value: boolean) => {
    showAmounts = value;
    listeners.forEach((listener) => listener());
    await AsyncStorage.setItem(SHOW_AMOUNTS_KEY, String(value));
  },
};
