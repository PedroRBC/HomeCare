const { AndroidConfig, withAndroidManifest, withFinalizedMod } = require("@expo/config-plugins");
const { mkdir, readFile, writeFile } = require("node:fs/promises");
const { join } = require("node:path");

const actions = [
  "android.intent.action.BOOT_COMPLETED",
  "android.intent.action.MY_PACKAGE_REPLACED",
  "android.intent.action.TIME_SET",
  "android.intent.action.TIMEZONE_CHANGED",
];

module.exports = (config, { widgets }) => {
  const widgetPackage = `${config.android.package}.widget`;
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    AndroidConfig.Permissions.ensurePermission(
      manifest,
      "android.permission.RECEIVE_BOOT_COMPLETED",
    );
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    for (const name of widgets) {
      const receiver = application.receiver.find(
        (item) => item.$["android:name"] === `.widget.${name}`,
      );
      const filter = receiver["intent-filter"][0];
      for (const action of actions) {
        if (!filter.action.some((item) => item.$["android:name"] === action)) {
          filter.action.push({ $: { "android:name": action } });
        }
      }
    }
    return modConfig;
  });

  // Finalized runs after the library generates its otherwise empty provider subclasses.
  return withFinalizedMod(config, [
    "android",
    async (modConfig) => {
      const destination = join(
        modConfig.modRequest.platformProjectRoot,
        "app/src/main/java",
        widgetPackage.replaceAll(".", "/"),
      );
      await mkdir(destination, { recursive: true });
      const provider = await readFile(require.resolve("./HomeCareWidgetProvider.java"), "utf8");
      await writeFile(
        join(destination, "HomeCareWidgetProvider.java"),
        provider.replace("package homecare.widget;", `package ${widgetPackage};`),
      );
      for (const name of widgets) {
        await writeFile(
          join(destination, `${name}.java`),
          `package ${widgetPackage};\n\npublic class ${name} extends HomeCareWidgetProvider {}\n`,
        );
      }
      return modConfig;
    },
  ]);
};
