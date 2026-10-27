import { test } from "node:test";
import assert from "node:assert/strict";
import { HOUSE_COLORS, dayHouseColors, houseColorMap } from "./houseColors";

const luminance = (hex: string) => {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

test("every house color keeps white day numbers readable", () => {
  for (const color of HOUSE_COLORS) {
    assert.ok(1.05 / (luminance(color) + 0.05) >= 4.5, color);
  }
});

test("houses use their chosen color, or a distinct default when none or an unknown one", () => {
  const colors = houseColorMap(["a", "b", "c"], { b: HOUSE_COLORS[5], c: "#123456" });
  assert.deepEqual(colors, { a: HOUSE_COLORS[0], b: HOUSE_COLORS[5], c: HOUSE_COLORS[2] });
});

test("a day with two houses gets both colors once, in the houses' order", () => {
  const colors = houseColorMap(["a", "b", "c"], {});
  assert.deepEqual(dayHouseColors(["c", "a", "c"], colors), [HOUSE_COLORS[0], HOUSE_COLORS[2]]);
  assert.deepEqual(dayHouseColors([], colors), []);
});
