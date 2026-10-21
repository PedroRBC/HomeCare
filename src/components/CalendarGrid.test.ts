import { test } from "node:test";
import assert from "node:assert/strict";
import { createRenderer, installNativeRuntime, nodes } from "../test/native";
installNativeRuntime();
const { CalendarGrid } = await import("./CalendarGrid");
const { CalendarHeader } = await import("./CalendarHeader");

test("calendar dates expose full date and payment status rather than an ambiguous number", () => {
  const renderer = createRenderer();
  let chosen: Date | undefined;
  const date = new Date(2026, 9, 21);
  const tree = renderer.render(() =>
    CalendarGrid({
      daysGrid: [date],
      scheduledCaregiversForDate: () => [{ id: "ana" }] as any,
      getDayPaymentStatus: () => "none",
      onDayPress: (value) => {
        chosen = value;
      },
    }),
  );
  const cell = nodes(tree).find((node) => node.type === "Pressable")!;
  assert.match(cell.props.accessibilityLabel, /2026/);
  assert.match(cell.props.accessibilityLabel, /common.pending/);
  cell.props.onPress();
  assert.equal(chosen, date);
  renderer.unmount();
});

test("calendar month controls have named button roles and independent48dp targets", () => {
  const renderer = createRenderer();
  const tree = renderer.render(() =>
    CalendarHeader({
      monthLabel: "October 2026",
      onPrev: () => {},
      onNext: () => {},
      onToday: () => {},
    }),
  );
  const buttons = nodes(tree).filter((node) => node.type === "Pressable");
  assert.equal(buttons.length, 3);
  for (const button of buttons) {
    assert.equal(button.props.accessibilityRole, "button");
    assert.ok(button.props.accessibilityLabel);
    assert.match(button.props.className, /min-h-12/);
  }
  renderer.unmount();
});
