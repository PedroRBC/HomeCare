import { test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { CommonActions, StackActions, StackRouter } from "@react-navigation/routers";
import { createRenderer, installNativeRuntime } from "../test/native";
installNativeRuntime();
const router = StackRouter({ initialRouteName: "HouseManagement" });
const options = {
  routeNames: ["HouseManagement", "CareManagement"],
  routeParamList: {},
  routeGetIdList: {},
};
let state = router.getInitialState(options);
let selection: string | null = "house-a";
const dispatch = (action: any) => {
  const next = router.getStateForAction(state, action, options);
  if (next) state = router.getRehydratedState(next, options);
};
mock.module("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: (name: string) => dispatch(CommonActions.navigate(name)),
    reset: (next: any) => dispatch(CommonActions.reset(next)),
  }),
}));
mock.module("@/context/HouseContext", () => ({
  useHouse: () => ({
    clearCurrentHouseSelection: () => {
      selection = null;
    },
  }),
}));
const { useAppNavigation } = await import("./useAppNavigation");

test("switching A to B cannot return through Back to house A's draft navigator", () => {
  state = router.getInitialState(options);
  selection = "house-a";
  dispatch(CommonActions.navigate("CareManagement"));
  const oldDraftRoute = state.routes.at(-1)!.key;
  const renderer = createRenderer();
  const navigation = renderer.render(useAppNavigation);
  navigation.navigateToHouseManagement();
  assert.equal(selection, null);
  selection = "house-b";
  navigation.navigateToCareManagement();
  dispatch(CommonActions.goBack());
  dispatch(StackActions.pop(1));
  assert.ok(state.routes.every((route) => route.key !== oldDraftRoute));
  assert.equal(state.routes.length, 1);
  assert.equal(state.routes[0].name, "HouseManagement");
  renderer.unmount();
});
