import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const packageName = "com.example.homecare";
const widgets = ["TodayShifts", "Payments"];

// Only Android/the upstream provider are doubled; the generated Java runs on the JVM.
const javaFixtures: Record<string, string> = {
  "android/content/Context.java": `package android.content;
    public class Context {
      public static final String ALARM_SERVICE = "alarm";
      public final android.app.AlarmManager alarms = new android.app.AlarmManager();
      public Object getSystemService(String name) { return alarms; }
    }`,
  "android/content/Intent.java": `package android.content;
    public class Intent {
      public static final String ACTION_TIME_CHANGED = "android.intent.action.TIME_SET";
      public static final String ACTION_TIMEZONE_CHANGED = "android.intent.action.TIMEZONE_CHANGED";
      public static final String ACTION_BOOT_COMPLETED = "android.intent.action.BOOT_COMPLETED";
      public static final String ACTION_MY_PACKAGE_REPLACED = "android.intent.action.MY_PACKAGE_REPLACED";
      private String action;
      public final Class<?> target;
      public Intent(Context context, Class<?> target) { this.target = target; }
      public Intent setAction(String value) { action = value; return this; }
      public String getAction() { return action; }
    }`,
  "android/content/ComponentName.java": `package android.content;
    public class ComponentName { public ComponentName(Context context, Class<?> type) {} }`,
  "android/app/PendingIntent.java": `package android.app;
    import android.content.*;
    public class PendingIntent {
      public static final int FLAG_UPDATE_CURRENT = 1, FLAG_IMMUTABLE = 2;
      public Intent intent;
      public static PendingIntent getBroadcast(Context context, int code, Intent intent, int flags) {
        PendingIntent result = new PendingIntent(); result.intent = intent; return result;
      }
    }`,
  "android/app/AlarmManager.java": `package android.app;
    public class AlarmManager {
      public static final int RTC_WAKEUP = 0;
      public long trigger;
      public PendingIntent operation;
      public void setAndAllowWhileIdle(int type, long time, PendingIntent pending) {
        if (type != RTC_WAKEUP) throw new AssertionError("must use the local clock");
        trigger = time; operation = pending;
      }
      public void cancel(PendingIntent pending) { trigger = 0; operation = null; }
    }`,
  "android/appwidget/AppWidgetManager.java": `package android.appwidget;
    import android.content.*;
    public class AppWidgetManager {
      public static final AppWidgetManager INSTANCE = new AppWidgetManager();
      public int[] ids = {11, 22};
      public static AppWidgetManager getInstance(Context context) { return INSTANCE; }
      public int[] getAppWidgetIds(ComponentName name) { return ids; }
    }`,
  "com/reactnativeandroidwidget/RNWidgetProvider.java": `package com.reactnativeandroidwidget;
    import android.content.*;
    import android.appwidget.AppWidgetManager;
    public class RNWidgetProvider {
      public int updates, received, disabled;
      public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { updates += ids.length; }
      public void onReceive(Context context, Intent intent) { received++; }
      public void onDisabled(Context context) { disabled++; }
    }`,
  "WidgetDateRefreshCheck.java": `import android.content.*;
    import android.appwidget.AppWidgetManager;
    import com.example.homecare.widget.*;
    import java.time.*;
    import java.util.TimeZone;
    public class WidgetDateRefreshCheck {
      public static void main(String[] args) {
        for (String zone : new String[]{"America/Sao_Paulo", "America/New_York", "Asia/Tokyo"}) {
          TimeZone.setDefault(TimeZone.getTimeZone(zone));
          for (HomeCareWidgetProvider provider : new HomeCareWidgetProvider[]{new TodayShifts(), new Payments()}) {
            Context context = new Context();
            AppWidgetManager manager = AppWidgetManager.INSTANCE;
            manager.ids = new int[]{11, 22};
            provider.onUpdate(context, manager, manager.ids);
            check(provider.updates == 2, "initial update must keep upstream rendering");
            ZonedDateTime midnight = Instant.ofEpochMilli(context.alarms.trigger).atZone(ZoneId.systemDefault());
            check(midnight.toLocalDate().equals(LocalDate.now().plusDays(1)), "next local day");
            check(midnight.toLocalTime().equals(LocalTime.MIDNIGHT), "local midnight");
            check(context.alarms.operation.intent.target == provider.getClass(), "alarm targets its own widget type");
            Intent alarm = context.alarms.operation.intent;
            for (String action : new String[]{alarm.getAction(), Intent.ACTION_TIME_CHANGED,
                Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED}) {
              int before = provider.updates;
              context.alarms.trigger = 0;
              provider.onReceive(context, new Intent(context, provider.getClass()).setAction(action));
              check(provider.updates == before + 2, "refresh all widget instances: " + action);
              check(context.alarms.trigger > System.currentTimeMillis(), "rearm after refresh");
            }
            provider.onReceive(context, new Intent(context, provider.getClass()).setAction("widget-click"));
            check(provider.received == 1, "preserve normal widget click handling");
            manager.ids = new int[0];
            context.alarms.trigger = 0;
            provider.onReceive(context, alarm);
            check(context.alarms.trigger == 0, "no alarm without widgets");
            provider.onDisabled(context);
            check(context.alarms.operation == null && provider.disabled == 1, "cancel after last widget removal");
          }
        }
      }
      static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    }`,
};

test("date refresh survives prebuild and updates every instance without opening the app", async () => {
  const { default: withWidgetDateRefresh } = await import("../../plugins/withWidgetDateRefresh");
  const root = await mkdtemp(join(tmpdir(), "homecare-widget-date-"));
  try {
    const withAndroidWidgets = createRequire(import.meta.url)(
      "react-native-android-widget/app.plugin",
    ).default;
    const baseConfig = { name: "fixture", android: { package: packageName }, mods: {} };
    const config = withAndroidWidgets(withWidgetDateRefresh(baseConfig, { widgets }), {
      widgets: widgets.map((name) => ({ name, minWidth: "180dp", minHeight: "110dp" })),
    }) as any;
    let manifest: any = {
      manifest: { application: [{ $: { "android:name": ".MainApplication" } }] },
    };
    for (let run = 0; run < 2; run++) {
      const result = await config.mods.android.manifest({
        ...baseConfig,
        modResults: manifest,
        modRequest: {
          platformProjectRoot: root,
          projectRoot: root,
          nextMod: async (value: unknown) => value,
        },
      });
      manifest = result.modResults;
      await config.mods.android.finalized({
        modRequest: { platformProjectRoot: root, nextMod: async (value: unknown) => value },
      });
    }
    assert.equal(manifest.manifest["uses-permission"].length, 1);
    assert.equal(
      manifest.manifest["uses-permission"][0].$["android:name"],
      "android.permission.RECEIVE_BOOT_COMPLETED",
    );
    for (const receiver of manifest.manifest.application[0].receiver) {
      assert.equal(receiver.$["android:exported"], "false");
      const actions = receiver["intent-filter"].flatMap((filter: any) =>
        filter.action.map((action: any) => action.$["android:name"]),
      );
      assert.deepEqual(
        actions.sort(),
        [
          "android.appwidget.action.APPWIDGET_UPDATE",
          `${packageName}.WIDGET_CLICK`,
          "android.intent.action.BOOT_COMPLETED",
          "android.intent.action.MY_PACKAGE_REPLACED",
          "android.intent.action.TIME_SET",
          "android.intent.action.TIMEZONE_CHANGED",
        ].sort(),
      );
    }
    const javaRoot = join(root, "app/src/main/java");
    const sources: string[] = [];
    for (const [path, content] of Object.entries(javaFixtures)) {
      const file = join(javaRoot, path);
      await mkdir(join(file, ".."), { recursive: true });
      await writeFile(file, content);
      sources.push(file);
    }
    for (const name of ["HomeCareWidgetProvider", ...widgets]) {
      const file = join(javaRoot, packageName.replaceAll(".", "/"), "widget", `${name}.java`);
      assert.ok((await readFile(file, "utf8")).startsWith(`package ${packageName}.widget;`));
      sources.push(file);
    }
    execFileSync("javac", ["-d", root, ...sources], { stdio: "pipe" });
    execFileSync("java", ["-cp", root, "WidgetDateRefreshCheck"], { stdio: "pipe" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
