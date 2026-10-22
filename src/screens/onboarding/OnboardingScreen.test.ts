import { test } from "node:test";
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { createRenderer, installNativeRuntime, nodes } from "../../test/native";

installNativeRuntime();
let width = 800;
mock.module("react-native", () => ({
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  FlatList: "FlatList",
  Dimensions: { get: () => ({ width }) },
  useWindowDimensions: () => ({ width }),
}));
mock.module("react-native-reanimated", () => ({
  default: { View: "AnimatedView" },
  FadeInDown: { duration: () => ({}) },
}));
const { OnboardingScreen } = await import("./OnboardingScreen");

test("onboarding resizes pages and preserves the selected slide after rotation", () => {
  const renderer = createRenderer();
  const render = () => {
    const tree = renderer.render(() => OnboardingScreen({ onComplete: () => {} }));
    return nodes(tree).find((node) => node.type === "FlatList")!;
  };
  const portrait = render();
  assert.equal(portrait.props.renderItem({ item: portrait.props.data[0] }).props.style.width, 800);
  portrait.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 1600 } } });

  width = 1280;
  const landscape = render();
  assert.equal(
    landscape.props.renderItem({ item: landscape.props.data[2] }).props.style.width,
    1280,
  );
  assert.equal(landscape.props.initialScrollIndex, 2);
  assert.deepEqual(landscape.props.getItemLayout(undefined, 2), {
    length: 1280,
    offset: 2560,
    index: 2,
  });
  renderer.unmount();
});
