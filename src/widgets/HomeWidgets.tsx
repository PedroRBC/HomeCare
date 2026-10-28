import React from "react";
import {
  FlexWidget,
  TextWidget,
  type ColorProp,
  type WidgetInfo,
} from "react-native-android-widget";
import { dateKey } from "@/utils/date";
import {
  paymentSummary,
  shiftsFor,
  type WidgetPalette,
  type WidgetShifts,
  type WidgetSnapshot,
} from "./widgetData";

export const WIDGET_NAMES = ["TodayShifts", "Payments"] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

type Layout = { compact: boolean; narrow: boolean; height: number };
type Props = { snapshot: WidgetSnapshot | null; palette: WidgetPalette; now: Date; layout: Layout };

const REGULAR = "Inter_400Regular";
const BOLD = "Inter_700Bold";
// Shown before the app ever wrote a snapshot (fresh install).
const FALLBACK_PALETTE: WidgetPalette = {
  surface: "#FFFFFF",
  text: "#172B4D",
  textSecondary: "#68768C",
  primary: "#2E5BDE",
  primarySoft: "#E8EEFE",
  night: "#6A5899",
  nightSoft: "#EEEAF7",
  danger: "#BF3030",
  dangerSoft: "#FDEBEC",
  success: "#137A48",
};

const color = (value: string) => value as ColorProp;

function Shell({
  palette,
  layout,
  title,
  aside,
  uri,
  children,
}: {
  palette: WidgetPalette;
  layout: Layout;
  title: string;
  aside?: string;
  uri?: string;
  children?: React.ReactNode;
}) {
  return (
    <FlexWidget
      clickAction={uri ? "OPEN_URI" : "OPEN_APP"}
      clickActionData={uri ? { uri } : undefined}
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        backgroundColor: color(palette.surface),
        borderRadius: 20,
        padding: layout.compact ? 8 : 14,
        flexGap: layout.compact ? 4 : 8,
      }}>
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: layout.narrow ? "column" : "row",
          alignItems: layout.narrow ? "flex-start" : "center",
          flexGap: layout.narrow ? 0 : 8,
        }}>
        <FlexWidget style={layout.narrow ? { width: "match_parent" } : { width: 0, flex: 1 }}>
          <TextWidget
            text={title}
            maxLines={1}
            truncate="END"
            style={{
              width: "match_parent",
              fontSize: 15,
              fontFamily: BOLD,
              color: color(palette.text),
            }}
          />
        </FlexWidget>
        {aside && (!layout.narrow || layout.height >= 105) ? (
          <TextWidget
            text={aside}
            maxLines={1}
            truncate="END"
            style={{
              width: layout.narrow ? "match_parent" : "wrap_content",
              fontSize: 12,
              fontFamily: REGULAR,
              color: color(palette.textSecondary),
            }}
          />
        ) : null}
      </FlexWidget>
      {React.Children.toArray(children)}
    </FlexWidget>
  );
}

function OpenApp({ palette, text }: { palette: WidgetPalette; text: string }) {
  return (
    <TextWidget
      text={text}
      maxLines={2}
      truncate="END"
      style={{
        width: "match_parent",
        fontSize: 13,
        fontFamily: REGULAR,
        color: color(palette.textSecondary),
      }}
    />
  );
}

function ShiftRow({
  label,
  names,
  nobody,
  tint,
  soft,
  palette,
}: {
  label: string;
  names: string[];
  nobody: string;
  tint: string;
  soft: string;
  palette: WidgetPalette;
}) {
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center" }}>
      <FlexWidget
        style={{
          backgroundColor: color(soft),
          borderRadius: 8,
          paddingHorizontal: 8,
          paddingVertical: 3,
          marginRight: 8,
        }}>
        <TextWidget text={label} style={{ fontSize: 12, fontFamily: BOLD, color: color(tint) }} />
      </FlexWidget>
      <FlexWidget style={{ width: 0, flex: 1 }}>
        <TextWidget
          text={names.length ? names.join(", ") : nobody}
          maxLines={1}
          truncate="END"
          style={{
            width: "match_parent",
            fontSize: 14,
            fontFamily: names.length ? BOLD : REGULAR,
            color: color(names.length ? palette.text : palette.textSecondary),
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

const summarize = (shifts: WidgetShifts | undefined, labels: WidgetSnapshot["labels"]) =>
  `${labels.tomorrow}: ${labels.day} ${shifts?.day.join(", ") || "–"} · ${labels.night} ${
    shifts?.night.join(", ") || "–"
  }`;

export function TodayWidget({ snapshot, palette, now, layout }: Props) {
  const house = snapshot?.house;
  const shifts = house && shiftsFor(house, now);
  if (!snapshot || !shifts?.today) {
    return (
      <Shell palette={palette} layout={layout} title={snapshot?.labels.todayTitle ?? "HomeCare"}>
        {snapshot ? <OpenApp palette={palette} text={snapshot.labels.openApp} /> : null}
      </Shell>
    );
  }
  const { labels } = snapshot;
  return (
    <Shell
      palette={palette}
      layout={layout}
      title={labels.todayTitle}
      aside={
        layout.compact && layout.narrow
          ? undefined
          : now.toLocaleDateString(snapshot.locale, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })
      }
      uri={`homecare://day/${dateKey(now)}`}>
      <ShiftRow
        label={labels.day}
        names={shifts.today.day}
        nobody={labels.nobody}
        tint={palette.primary}
        soft={palette.primarySoft}
        palette={palette}
      />
      <ShiftRow
        label={labels.night}
        names={shifts.today.night}
        nobody={labels.nobody}
        tint={palette.night}
        soft={palette.nightSoft}
        palette={palette}
      />
      {layout.height >= 140 ? (
        <TextWidget
          text={summarize(shifts.tomorrow, labels)}
          maxLines={1}
          truncate="END"
          style={{
            width: "match_parent",
            fontSize: 12,
            fontFamily: REGULAR,
            color: color(palette.textSecondary),
          }}
        />
      ) : null}
    </Shell>
  );
}

function Stat({
  value,
  label,
  tint,
  soft,
  palette,
  compact,
}: {
  value: string;
  label: string;
  tint: string;
  soft: string;
  palette: WidgetPalette;
  compact: boolean;
}) {
  return (
    <FlexWidget
      style={{
        width: 0,
        flex: 1,
        flexDirection: "column",
        backgroundColor: color(soft),
        borderRadius: 12,
        padding: compact ? 4 : 8,
      }}>
      <TextWidget
        text={value}
        maxLines={1}
        truncate="END"
        style={{
          width: "match_parent",
          fontSize: compact ? 18 : 20,
          fontFamily: BOLD,
          color: color(tint),
        }}
      />
      <TextWidget
        text={label}
        maxLines={1}
        truncate="END"
        style={{
          width: "match_parent",
          fontSize: 12,
          fontFamily: REGULAR,
          color: color(palette.text),
        }}
      />
    </FlexWidget>
  );
}

export function PaymentsWidget({ snapshot, palette, now, layout }: Props) {
  const house = snapshot?.house;
  if (!snapshot || !house) {
    return (
      <Shell palette={palette} layout={layout} title={snapshot?.labels.paymentsTitle ?? "HomeCare"}>
        {snapshot ? <OpenApp palette={palette} text={snapshot.labels.openApp} /> : null}
      </Shell>
    );
  }
  const { labels, locale } = snapshot;
  const summary = paymentSummary(house, now);
  const money =
    summary.pendingAmount === undefined || summary.pending === 0
      ? undefined
      : `R$ ${summary.pendingAmount.toLocaleString(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
  const next = summary.next;
  const footer = next
    ? labels.next.replace("{{name}}", next.caregiver).replace(
        "{{date}}",
        new Date(`${next.due}T12:00:00`).toLocaleDateString(locale, {
          day: "numeric",
          month: "short",
        }),
      )
    : undefined;
  return (
    <Shell
      palette={palette}
      layout={layout}
      title={labels.paymentsTitle}
      aside={money}
      uri="homecare://payments">
      {summary.pending + summary.upcoming === 0 ? (
        <TextWidget
          text={labels.nothingDue}
          maxLines={2}
          truncate="END"
          style={{
            width: "match_parent",
            fontSize: 16,
            fontFamily: BOLD,
            color: color(palette.success),
          }}
        />
      ) : (
        <FlexWidget style={{ width: "match_parent", flexDirection: "row", flexGap: 8 }}>
          <Stat
            value={String(summary.pending)}
            label={labels.pending}
            tint={summary.pending ? palette.danger : palette.textSecondary}
            soft={summary.pending ? palette.dangerSoft : palette.primarySoft}
            palette={palette}
            compact={layout.compact}
          />
          <Stat
            value={String(summary.upcoming)}
            label={labels.upcoming}
            tint={palette.primary}
            soft={palette.primarySoft}
            palette={palette}
            compact={layout.compact}
          />
        </FlexWidget>
      )}
      {footer && layout.height >= (layout.narrow && money ? 160 : 140) ? (
        <TextWidget
          text={footer}
          maxLines={1}
          truncate="END"
          style={{
            width: "match_parent",
            fontSize: 12,
            fontFamily: REGULAR,
            color: color(palette.textSecondary),
          }}
        />
      ) : null}
    </Shell>
  );
}

export function renderHomeWidget(
  info: WidgetInfo,
  snapshot: WidgetSnapshot | null,
  now = new Date(),
) {
  const Widget = info.widgetName === "Payments" ? PaymentsWidget : TodayWidget;
  const palettes = snapshot?.palettes ?? { light: FALLBACK_PALETTE, dark: FALLBACK_PALETTE };
  // Use this instance's space, not the phone's screen width or launcher grid columns.
  const fontScale = Math.max(1, info.screenInfo.fontScale);
  const height = info.height / fontScale;
  const layout: Layout = { compact: height < 150, narrow: info.width / fontScale < 280, height };
  return {
    light: <Widget snapshot={snapshot} palette={palettes.light} now={now} layout={layout} />,
    dark: <Widget snapshot={snapshot} palette={palettes.dark} now={now} layout={layout} />,
  };
}
