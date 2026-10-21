import { test } from "node:test";
import assert from "node:assert/strict";
import { createRenderer, installNativeRuntime, nodes } from "../test/native";
installNativeRuntime();
const { AvatarPicker } = await import("./AvatarPicker");

test("avatar choices announce names and selected states; Android back cancels without selecting", () => {
  let selected = 0;
  let closed = 0;
  const renderer = createRenderer();
  const tree = renderer.render(() =>
    AvatarPicker({
      visible: true,
      currentConfig: { icon: "person", color: "#059669" },
      onSelect: () => {
        selected++;
      },
      onClose: () => {
        closed++;
      },
    }),
  );
  const choices = nodes(tree).filter((node) => node.props.accessibilityRole === "radio");
  assert.equal(choices.length, 28);
  assert.equal(choices.filter((node) => node.props.accessibilityState?.checked).length, 2);
  assert.ok(choices.every((node) => node.props.accessibilityLabel));
  choices[1].props.onPress();
  nodes(tree)
    .find((node) => node.type === "Modal")!
    .props.onRequestClose();
  assert.equal(selected, 0);
  assert.equal(closed, 1);
  renderer.unmount();
});
