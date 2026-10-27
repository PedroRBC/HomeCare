import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HOUSE_COLORS,
  contrast,
  dayHouseColors,
  hexToHsl,
  houseColorMap,
  hslToHex,
  normalizeHex,
  readableTextOn,
} from "./houseColors";

test("houses use their chosen color, or a distinct default when none or an invalid one", () => {
  const colors = houseColorMap(["a", "b", "c"], { b: "#FFEE00", c: "blue" });
  assert.deepEqual(colors, { a: HOUSE_COLORS[0], b: "#FFEE00", c: HOUSE_COLORS[2] });
});

test("a day with two houses gets both colors once, in the houses' order", () => {
  const colors = houseColorMap(["a", "b", "c"], {});
  assert.deepEqual(dayHouseColors(["c", "a", "c"], colors), [HOUSE_COLORS[0], HOUSE_COLORS[2]]);
  assert.deepEqual(dayHouseColors([], colors), []);
});

test("typed colors are normalized or rejected", () => {
  assert.equal(normalizeHex(" ff8800 "), "#FF8800");
  assert.equal(normalizeHex("#abc"), "#AABBCC");
  assert.equal(normalizeHex("#12345"), null);
  assert.equal(normalizeHex("red"), null);
});

test("hsl and hex convert back and forth", () => {
  for (const hex of [...HOUSE_COLORS, "#000000", "#FFFFFF", "#808080"]) {
    assert.ok(contrast(hslToHex(hexToHsl(hex)), hex) < 1.05, hex);
  }
  assert.equal(hslToHex({ h: 0, s: 100, l: 50 }), "#FF0000");
});

test("day numbers switch to dark text on light colors", () => {
  assert.equal(readableTextOn([HOUSE_COLORS[0]]), "#FFFFFF");
  assert.equal(readableTextOn(["#FFEE00"]), "#172B4D");
  for (const fills of [[HOUSE_COLORS[0], "#FFEE00"], ["#FFFFFF"], ["#000000"]]) {
    assert.ok(contrast(readableTextOn(fills), fills[0]) >= 1.5);
  }
});
