import { test } from "node:test";
import assert from "node:assert/strict";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { compile } from "react-native-css/compiler";
import { createRenderer, installNativeRuntime, nodes } from "../test/native";
installNativeRuntime();
const { CalendarHeader } = await import("./CalendarHeader");
const { PasswordToggle } = await import("./PasswordToggle");
const { CalendarGrid } = await import("./CalendarGrid");
const { ScreenHeading } = await import("./ScreenHeading");

test("working-screen hierarchy compiles to24sp headings and14sp descriptions", async () => {
  const elements = nodes(ScreenHeading({ title: "Houses", subtitle: "Choose a house" })).filter(
    (node) => node.type === "Text",
  );
  const classes = elements.flatMap((node) => node.props.className.split(/\s+/));
  const result = await postcss([tailwind()]).process(
    `@import "tailwindcss/theme.css"; @import "tailwindcss/utilities.css"; @source inline("${classes.join(" ")}");`,
    { from: new URL("../../global.css", import.meta.url).pathname },
  );
  const rules = new Map(compile(result.css).stylesheet().s);
  for (const [index, expected] of [24, 14].entries()) {
    const styles = elements[index].props.className
      .split(/\s+/)
      .flatMap((utility: string) =>
        (rules.get(utility) ?? []).flatMap((rule: any) => rule.d ?? []),
      );
    const fontSize = styles.find((style: any) => style.fontSize !== undefined)?.fontSize;
    assert.equal(fontSize, expected);
  }
});

test("native touch controls compile to48dp rather than42dp under the14px rem default", async () => {
  const renderer = createRenderer();
  const controls = [
    ...nodes(
      renderer.render(() =>
        CalendarHeader({
          monthLabel: "October",
          onPrev: () => {},
          onNext: () => {},
          onToday: () => {},
        }),
      ),
    ).filter((node) => node.type === "Pressable"),
    renderer.render(() => PasswordToggle({ visible: false, onPress: () => {} })),
    ...nodes(
      renderer.render(() =>
        CalendarGrid({
          daysGrid: [new Date(2026, 9, 21)],
          getDayPaymentStatus: () => "none",
          scheduledCaregiversForDate: () => [],
          onDayPress: () => {},
        }),
      ),
    ).filter((node) => node.type === "Pressable"),
  ];
  const classes = controls.flatMap((node) => node.props.className.split(/\s+/));
  const result = await postcss([tailwind()]).process(
    `@import "tailwindcss/theme.css"; @import "tailwindcss/utilities.css"; @source inline("${classes.join(" ")}");`,
    { from: new URL("../../global.css", import.meta.url).pathname },
  );
  const rules = new Map(compile(result.css).stylesheet().s);
  for (const [index, control] of controls.entries()) {
    const styles = control.props.className
      .split(/\s+/)
      .flatMap((utility: string) =>
        (rules.get(utility) ?? []).flatMap((rule: any) => rule.d ?? []),
      );
    const height = Math.max(...styles.map((style: any) => style.height ?? style.minHeight ?? 0));
    assert.ok(height >= 48, `control ${index} has ${height}dp height`);
  }
  renderer.unmount();
});
