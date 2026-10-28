import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { XML } from "@expo/config-plugins";

test("native widget resources fit the image in both themes and keep the whole widget clickable", async () => {
  const { default: withWidgetSizing } = await import("../../plugins/withWidgetSizing");
  const root = await mkdtemp(join(tmpdir(), "homecare-widget-sizing-"));
  try {
    const config = withWidgetSizing({ name: "fixture", mods: {} }) as any;
    const modConfig = {
      modRequest: { platformProjectRoot: root, nextMod: async (value: unknown) => value },
    };
    for (let run = 0; run < 2; run++) {
      await config.mods.android.dangerous(modConfig);
      for (const layout of ["layout", "layout-night"]) {
        const resource = await XML.parseXMLAsync(
          await readFile(join(root, "app/src/main/res", layout, "rn_widget.xml"), "utf8"),
        );
        const images = (resource.FrameLayout as any).ImageView;
        assert.deepEqual(
          images.map((image: any) => image.$["android:scaleType"]),
          ["fitCenter", "fitCenter"],
        );
        assert.deepEqual(
          images.map((image: any) => image.$["android:id"]),
          ["@+id/rn_widget_image_light", "@+id/rn_widget_image_dark"],
        );
        assert.deepEqual(
          images.map((image: any) => image.$["android:visibility"]),
          layout === "layout" ? ["visible", "gone"] : ["gone", "visible"],
        );
      }
      const clickable = await XML.parseXMLAsync(
        await readFile(join(root, "app/src/main/res/layout/rn_widget_clickable.xml"), "utf8"),
      );
      assert.equal(
        (clickable.FrameLayout as any).FrameLayout[0].$["android:layout_height"],
        "match_parent",
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
