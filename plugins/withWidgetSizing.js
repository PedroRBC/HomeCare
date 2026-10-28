const { withDangerousMod, XML } = require("@expo/config-plugins");
const { mkdir } = require("node:fs/promises");
const { dirname, join } = require("node:path");

module.exports = (config) =>
  withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const resources = join(
        dirname(require.resolve("react-native-android-widget/package.json")),
        "android/src/main/res",
      );
      for (const [layout, name] of [
        ["layout", "rn_widget.xml"],
        ["layout-night", "rn_widget.xml"],
        ["layout", "rn_widget_clickable.xml"],
      ]) {
        const xml = await XML.readXMLAsync({ path: join(resources, layout, name) });
        if (name === "rn_widget.xml") {
          // Some launchers report a larger size than they display; matrix crops the bitmap.
          for (const image of xml.FrameLayout.ImageView) {
            image.$["android:scaleType"] = "fitCenter";
          }
        } else {
          // shortcut: one full-widget action, remap hit areas before adding child actions.
          xml.FrameLayout.FrameLayout[0].$["android:layout_height"] = "match_parent";
        }
        const destination = join(
          modConfig.modRequest.platformProjectRoot,
          "app/src/main/res",
          layout,
        );
        await mkdir(destination, { recursive: true });
        await XML.writeXMLAsync({ path: join(destination, name), xml });
      }
      return modConfig;
    },
  ]);
