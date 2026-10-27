import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useHouse } from "@/context/HouseContext";
import { useSchedule } from "@/context/ScheduleContext";
import { useUpcomingPayments } from "@/hooks/useUpcomingPayments";
import { currentLocale } from "@/i18n/locale";
import { palettes, useAppTheme } from "@/theme";
import { dateKey } from "@/utils/date";
import { logger } from "@/utils/logger";
import {
  buildWidgetHouse,
  pickWidgetPalette,
  type WidgetLabels,
  type WidgetSnapshot,
} from "@/widgets/widgetData";
import { publishWidgetSnapshot, widgetAmounts } from "@/widgets/widgetStorage";

/** Keeps the home screen widgets in step with the selected house; clears them on sign out. */
export function useWidgetSync() {
  const { user } = useAuth();
  const { currentHouse } = useHouse();
  const { caregivers, scheduleByDay, isLoading, hasLoadError } = useSchedule();
  const payments = useUpcomingPayments();
  const { theme } = useAppTheme();
  const { t, i18n } = useTranslation();
  const showAmounts = useSyncExternalStore(widgetAmounts.subscribe, widgetAmounts.get);
  const today = dateKey(new Date());

  const serialized = useMemo(() => {
    const labels: WidgetLabels = {
      todayTitle: t("widgets.todayTitle"),
      today: t("common.today"),
      tomorrow: t("widgets.tomorrow"),
      day: t("common.day"),
      night: t("common.night"),
      nobody: t("widgets.nobody"),
      paymentsTitle: t("widgets.paymentsTitle"),
      pending: t("widgets.pending"),
      upcoming: t("widgets.upcoming"),
      allPaid: t("widgets.allPaid"),
      next: t("widgets.next", { name: "{{name}}", date: "{{date}}" }),
      openApp: t("widgets.openApp"),
    };
    const snapshot: WidgetSnapshot = {
      locale: currentLocale(),
      labels,
      palettes: {
        light: pickWidgetPalette(palettes[theme].light),
        dark: pickWidgetPalette(palettes[theme].dark),
      },
      house:
        user && currentHouse
          ? buildWidgetHouse({
              name: currentHouse.name,
              caregivers,
              scheduleByDay,
              payments,
              showAmounts,
            })
          : null,
    };
    return JSON.stringify(snapshot);
    // `today` and the language re-run this so the stored week window and labels stay current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    currentHouse,
    caregivers,
    scheduleByDay,
    payments,
    showAmounts,
    theme,
    t,
    i18n.language,
    today,
  ]);

  // Keep the last good snapshot while a signed-in house is still loading or failed to load.
  const ready = !user || !currentHouse || (!isLoading && !hasLoadError);
  // Back on the house list the selection is cleared; only signing out removes the house.
  const keepStoredHouse = !!user && !currentHouse;
  useEffect(() => {
    if (!ready) return;
    publishWidgetSnapshot(JSON.parse(serialized), keepStoredHouse).catch((error) =>
      logger.warn("Widget update failed", error),
    );
    // showAmounts: with no house selected the snapshot text doesn't change, but the stored amounts must go.
  }, [ready, serialized, keepStoredHouse, showAmounts]);
}
