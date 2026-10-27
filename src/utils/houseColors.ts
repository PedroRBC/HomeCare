// Dark enough for white day numbers and icons; the first is the brand primary
export const HOUSE_COLORS = [
  "#2E5BDE",
  "#C2410C",
  "#047857",
  "#7C3AED",
  "#BE185D",
  "#0E7490",
  "#4D7C0F",
  "#B91C1C",
];

// Chosen color of each house, or a different default by position
export function houseColorMap(houseIds: string[], chosen: Record<string, string>) {
  return Object.fromEntries(
    houseIds.map((id, i) => [
      id,
      HOUSE_COLORS.includes(chosen[id]) ? chosen[id] : HOUSE_COLORS[i % HOUSE_COLORS.length],
    ]),
  );
}

// Colors of the distinct houses of a day, in the houses' order
export function dayHouseColors(dayHouseIds: string[], colorByHouse: Record<string, string>) {
  return Object.keys(colorByHouse)
    .filter((id) => dayHouseIds.includes(id))
    .map((id) => colorByHouse[id]);
}
