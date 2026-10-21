import { test } from "node:test";
import assert from "node:assert/strict";
import { createRenderer, installNativeRuntime } from "../test/native";
installNativeRuntime();

test("password visibility announces the next action and preserves disabled state", async () => {
  const { PasswordToggle } = await import("./PasswordToggle");
  const renderer = createRenderer();
  let count = 0;
  const props = {
    visible: false,
    disabled: false,
    onPress: () => {
      count++;
    },
  };
  const hidden = renderer.render(() => PasswordToggle(props));
  assert.equal(hidden.props.accessibilityLabel, "common.showPassword");
  hidden.props.onPress();
  assert.equal(count, 1);
  const visible = renderer.render(() =>
    PasswordToggle({ ...props, visible: true, disabled: true }),
  );
  assert.equal(visible.props.accessibilityLabel, "common.hidePassword");
  assert.equal(visible.props.accessibilityState.disabled, true);
  assert.equal(visible.props.disabled, true);
  assert.match(visible.props.className, /h-\[48px\] w-\[48px\]/);
  renderer.unmount();
});
