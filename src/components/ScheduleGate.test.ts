import { test } from "node:test";
import assert from "node:assert/strict";
import { createRenderer, installNativeRuntime, nodes } from "../test/native";
installNativeRuntime();

test("loading keeps the same navigation child mounted and hides it from accessibility", async () => {
  const { ScheduleGate } = await import("./ScheduleGate");
  const child = { type: "Routes", props: {} } as any;
  const renderer = createRenderer();
  const ready = renderer.render(() => ScheduleGate({ loading: false, children: child }));
  const loading = renderer.render(() => ScheduleGate({ loading: true, children: child }));
  assert.ok(nodes(ready).includes(child));
  assert.ok(nodes(loading).includes(child));
  assert.equal(nodes(loading)[1].props.importantForAccessibility, "no-hide-descendants");
  assert.equal(nodes(ready)[1].props.importantForAccessibility, "auto");
  assert.equal(nodes(loading)[1].props.collapsable, false);
  assert.equal(nodes(ready)[1].props.collapsable, false);
  renderer.unmount();
});
