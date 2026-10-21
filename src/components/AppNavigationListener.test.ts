import { test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { createRenderer, installNativeRuntime } from "../test/native";
installNativeRuntime();
let house: { id: string; name: string } | null = { id: "a", name: "House A" };
const changes: string[] = [];
const navigation = {
  navigateToCareManagement: () => changes.push("care"),
  navigateToHouseManagement: () => changes.push("houses"),
};
mock.module("@/context/HouseContext", () => ({ useHouse: () => ({ currentHouse: house }) }));
mock.module("@/hooks/useAppNavigation", () => ({ useAppNavigation: () => navigation }));
const { AppNavigationListener } = await import("./AppNavigationListener");

test("same-house metadata refresh preserves navigation; only scope changes reset it", () => {
  const renderer = createRenderer();
  renderer.render(AppNavigationListener);
  house = { id: "a", name: "Renamed house A" };
  renderer.render(AppNavigationListener);
  assert.deepEqual(changes, []);
  house = { id: "b", name: "House B" };
  renderer.render(AppNavigationListener);
  assert.deepEqual(changes, ["care"]);
  house = null;
  renderer.render(AppNavigationListener);
  assert.deepEqual(changes, ["care", "houses"]);
  renderer.unmount();
});
