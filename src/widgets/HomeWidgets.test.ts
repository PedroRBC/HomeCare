import { test } from "node:test";
import assert from "node:assert/strict";
import { mock, setSystemTime } from "bun:test";
import type { WidgetInfo, WidgetTaskHandlerProps } from "react-native-android-widget";
import { FlexWidget } from "react-native-android-widget/src/widgets/FlexWidget";
import { TextWidget } from "react-native-android-widget/src/widgets/TextWidget";
import { buildWidgetTree } from "react-native-android-widget/src/api/build-widget-tree";
import { lightColors, darkColors } from "@/theme/palette";
import { pickWidgetPalette, type WidgetSnapshot } from "./widgetData";

const instances = [info("Payments", 180, 110), info("Payments", 360, 200)];
const published: ReturnType<typeof renderHomeWidget>[] = [];
let stored: string | null = null;
mock.module("react-native", () => ({ Platform: { OS: "android" } }));
mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async () => stored,
    setItem: async (_key: string, value: string) => {
      stored = value;
    },
  },
}));
mock.module("react-native-android-widget", () => ({
  FlexWidget,
  TextWidget,
  requestWidgetUpdate: async ({
    widgetName,
    renderWidget,
  }: {
    widgetName: string;
    renderWidget: (info: WidgetInfo) => ReturnType<typeof renderHomeWidget>;
  }) => {
    if (widgetName === "Payments") published.push(...instances.map(renderWidget));
  },
}));
const { renderHomeWidget } = await import("./HomeWidgets");
const { publishWidgetSnapshot } = await import("./widgetStorage");
const { widgetTaskHandler } = await import("./widgetTaskHandler");

function info(widgetName: string, width: number, height: number, fontScale = 1): WidgetInfo {
  return {
    widgetName,
    widgetId: width,
    width,
    height,
    screenInfo: { screenWidthDp: 400, screenHeightDp: 800, density: 2, densityDpi: 320, fontScale },
  };
}

const now = new Date(2026, 9, 28, 12);
const snapshot: WidgetSnapshot = {
  locale: "pt-BR",
  labels: {
    todayTitle: "Plantão de hoje",
    today: "Hoje",
    tomorrow: "Amanhã",
    day: "Dia",
    night: "Noite",
    nobody: "Ninguém escalado",
    paymentsTitle: "Pagamentos",
    pending: "Pendentes",
    upcoming: "Próx. 7 dias",
    nothingDue: "Nada vence esta semana",
    next: "Próximo: {{name}} · {{date}}",
    openApp: "Abra o HomeCare e escolha uma casa",
  },
  palettes: { light: pickWidgetPalette(lightColors), dark: pickWidgetPalette(darkColors) },
  house: {
    name: "Casa",
    days: {
      "2026-10-28": { day: ["Maria", "Ana", "Alexandria"], night: ["Carolina"] },
      "2026-10-29": { day: ["Maria"], night: ["Ana"] },
    },
    payments: [
      { caregiver: "Maria", due: "2026-10-27", amount: 123456.78 },
      { caregiver: "Ana", due: "2026-10-30" },
    ],
  },
};

type Tree = { type: string; props: Record<string, any>; children: Tree[] };
const tree = (element: React.JSX.Element) => buildWidgetTree(element) as Tree;
const nodes = (root: Tree): Tree[] => [root, ...root.children.flatMap(nodes)];
const texts = (root: Tree) => nodes(root).flatMap((node) => node.props.text ?? []);

test("short widgets use compact spacing without losing today's two shifts", () => {
  for (const theme of ["light", "dark"] as const) {
    const small = tree(renderHomeWidget(info("TodayShifts", 180, 110), snapshot, now)[theme]);
    const large = tree(renderHomeWidget(info("TodayShifts", 360, 200), snapshot, now)[theme]);
    assert.ok(small.props.padding.top < large.props.padding.top);
    assert.ok(small.props.separator.size < large.props.separator.size);
    assert.ok(texts(small).includes("Maria, Ana, Alexandria"));
    assert.ok(texts(small).includes("Carolina"));
    assert.ok(!texts(small).some((text) => text.startsWith("Amanhã:")));
    assert.ok(texts(large).some((text) => text.startsWith("Amanhã:")));
    assert.equal(small.props.clickActionData.uri, "homecare://day/today");
  }
});

test("shift names have a bounded remaining width so Android can ellipsize them", () => {
  const root = tree(renderHomeWidget(info("TodayShifts", 180, 110), snapshot, now).light);
  const row = nodes(root).find((node) =>
    node.children.some((child) => child.props.text === "Maria, Ana, Alexandria"),
  )!;
  assert.equal(row.props.weight, 1);
  assert.equal(row.props.width, 0);
  assert.equal(row.children[0].props.width, "match_parent");
  assert.equal(row.children[0].props.truncate, "END");
});

test("narrow payments stack the amount and give the counters equal bounded widths", () => {
  for (const width of [180, 240]) {
    const root = tree(renderHomeWidget(info("Payments", width, 110), snapshot, now).light);
    assert.equal(root.children[0].props.orientation, "VERTICAL");
    assert.ok(texts(root).includes("R$ 123.456,78"));
    assert.ok(texts(root).includes("Pendentes"));
    assert.ok(texts(root).includes("Próx. 7 dias"));
    assert.ok(!texts(root).some((text) => text.startsWith("Próximo:")));
    const counters = root.children[1].children;
    assert.deepEqual(
      counters.map((counter) => [counter.props.width, counter.props.weight]),
      [
        [0, 1],
        [0, 1],
      ],
    );
    assert.equal(root.props.clickActionData.uri, "homecare://payments");
  }
});

test("roomy widgets retain their metadata while large fonts select the compact layout", () => {
  const regular = tree(renderHomeWidget(info("Payments", 360, 200), snapshot, now).light);
  assert.equal(regular.children[0].props.orientation, "HORIZONTAL");
  assert.ok(texts(regular).some((text) => text.startsWith("Próximo:")));
  const narrow = tree(renderHomeWidget(info("Payments", 180, 200), snapshot, now).light);
  assert.ok(texts(narrow).some((text) => text.startsWith("Próximo:")));
  const shortLargeFont = tree(
    renderHomeWidget(info("Payments", 180, 110, 1.3), snapshot, now).light,
  );
  assert.ok(!texts(shortLargeFont).some((text) => text.startsWith("R$")));
  assert.ok(texts(shortLargeFont).includes("Pendentes"));
  assert.ok(texts(shortLargeFont).includes("Próx. 7 dias"));
  const largeFont = tree(renderHomeWidget(info("TodayShifts", 240, 140, 1.5), snapshot, now).light);
  assert.ok(!texts(largeFont).some((text) => text.startsWith("Amanhã:")));
  assert.ok(texts(largeFont).includes("Carolina"));
  assert.ok(
    nodes(largeFont)
      .filter((node) => node.type === "TextWidget")
      .every((node) => node.props.allowFontScaling),
  );
});

test("compact fallback and empty widgets still render and open the app", () => {
  for (const widgetName of ["TodayShifts", "Payments"]) {
    for (const saved of [null, { ...snapshot, house: null }]) {
      for (const element of Object.values(
        renderHomeWidget(info(widgetName, 180, 110), saved, now),
      )) {
        const root = tree(element);
        assert.equal(root.props.clickAction, "OPEN_APP");
        assert.ok(texts(root).includes(saved ? saved.labels.openApp : "HomeCare"));
      }
    }
  }
  const empty = { ...snapshot, house: { ...snapshot.house!, payments: [] } };
  const root = tree(renderHomeWidget(info("Payments", 180, 110), empty, now).light);
  assert.ok(texts(root).includes("Nada vence esta semana"));
  assert.equal(root.props.clickActionData.uri, "homecare://payments");
});

test("resize events and app updates both use each widget instance's dimensions", async () => {
  await publishWidgetSnapshot(snapshot);
  assert.equal(published.length, 2);
  assert.equal(tree(published[0].light).children[0].props.orientation, "VERTICAL");
  assert.equal(tree(published[1].light).children[0].props.orientation, "HORIZONTAL");
  let resized: ReturnType<typeof renderHomeWidget> | undefined;
  await widgetTaskHandler({
    widgetAction: "WIDGET_RESIZED",
    widgetInfo: instances[0],
    renderWidget: (widget) => {
      resized = widget as typeof resized;
    },
  } satisfies WidgetTaskHandlerProps);
  assert.equal(tree(resized!.light).children[0].props.orientation, "VERTICAL");
});

test("headless updates roll cached shifts and payment counters into the next local day", async () => {
  try {
    setSystemTime(new Date(2026, 9, 29, 23, 59));
    await publishWidgetSnapshot({
      ...snapshot,
      house: {
        ...snapshot.house!,
        days: {
          ...snapshot.house!.days,
          "2026-10-30": { day: ["Bia"], night: ["João"] },
        },
      },
    });
    setSystemTime(new Date(2026, 9, 30, 0, 1));
    for (const widgetName of ["TodayShifts", "Payments"]) {
      let updated: ReturnType<typeof renderHomeWidget> | undefined;
      await widgetTaskHandler({
        widgetAction: "WIDGET_UPDATE",
        widgetInfo: info(widgetName, 180, 110),
        renderWidget: (widget) => {
          updated = widget as typeof updated;
        },
      } satisfies WidgetTaskHandlerProps);
      for (const theme of ["light", "dark"] as const) {
        const root = tree(updated![theme]);
        if (widgetName === "TodayShifts") {
          assert.ok(texts(root).includes("Bia"));
          assert.ok(texts(root).includes("João"));
          assert.ok(!texts(root).includes("Maria"));
          assert.equal(root.props.clickActionData.uri, "homecare://day/today");
        } else {
          assert.ok(texts(root).includes("2"));
          assert.ok(texts(root).includes("0"));
        }
      }
    }
  } finally {
    setSystemTime();
  }
});
