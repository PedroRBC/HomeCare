import type { ExpoConfig, ConfigContext } from "expo/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveGoogleWebClientId } from "./src/utils/googleSignInConfig";
import { resolveFacebookConfig } from "./src/utils/facebookSignInConfig";
import {
  resolveAndroidVersionCode,
  withAndroidReleaseSigning,
} from "./src/utils/androidReleaseConfig";

interface AppConfig extends ExpoConfig {
  extra: {
    eas: {
      projectId: string;
    };
    googleWebClientId?: string;
    googleIosClientId?: string;
    googleAndroidClientId?: string;
    facebookEnabled: boolean;
    facebookAppId?: string;
  };
}

export default ({ config }: ConfigContext): AppConfig => {
  const androidPackage = "com.pedrorbc.HomeCare";
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim() || "./google-services.json";
  const googleWebClientId = resolveGoogleWebClientId({
    webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
    androidPackage,
    loadGoogleServices: () => {
      try {
        return JSON.parse(readFileSync(resolve(__dirname, googleServicesFile), "utf8"));
      } catch {
        throw new Error(
          "Unable to read the selected google-services.json. Provide a valid GOOGLE_SERVICES_JSON file or GOOGLE_WEB_CLIENT_ID override.",
        );
      }
    },
  });
  const facebook = resolveFacebookConfig({
    appId: process.env.FACEBOOK_APP_ID,
    clientToken: process.env.FACEBOOK_CLIENT_TOKEN,
  });
  const facebookPlugin: [string, Record<string, unknown>] | undefined = facebook.enabled
    ? [
        "react-native-fbsdk-next",
        {
          appID: facebook.appId,
          clientToken: facebook.clientToken,
          displayName: "HomeCare",
          isAutoInitEnabled: false,
          autoLogAppEventsEnabled: false,
          advertiserIDCollectionEnabled: false,
          iosUserTrackingPermission: false,
        },
      ]
    : undefined;

  return withAndroidReleaseSigning({
    ...config,
    name: "HomeCare",
    slug: "HomeCare",
    version: "3.0.3",
    web: {
      favicon: "./assets/favicon.png",
    },
    experiments: {
      tsconfigPaths: true,
    },
    orientation: "portrait",
    // Required by @react-native-firebase v26 (legacy bridge removed)
    newArchEnabled: true,
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.pedrorbc.HomeCare",
      // googleServicesFile: process.env.GOOGLE_SERVICES_PLIST || "./GoogleService-Info.plist",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        monochromeImage: "./assets/adaptive-icon-monochrome.png",
        backgroundColor: "#2E5BDE",
      },
      package: androidPackage,
      // CI can override the release default; EAS manages its own remote version code.
      versionCode: resolveAndroidVersionCode(process.env.ANDROID_VERSION_CODE) ?? 34,
      googleServicesFile,
      allowBackup: false,
      blockedPermissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW",
        // No advertising features: prevent transitive SDK manifests from adding ad access.
        // "com.google.android.gms.permission.AD_ID",
        // "android.permission.ACCESS_ADSERVICES_AD_ID",
        // "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
        // "android.permission.ACCESS_ADSERVICES_CUSTOM_AUDIENCE",
        // "android.permission.ACCESS_ADSERVICES_TOPICS",
      ],
    },
    extra: {
      eas: {
        projectId: "ae9c4bb2-594d-415e-ae20-40b270e257c1",
      },
      googleWebClientId,
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
      facebookEnabled: facebook.enabled,
      ...(facebook.enabled ? { facebookAppId: facebook.appId } : {}),
    },
    plugins: [
      "expo-font",
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon-light.png",
          imageWidth: 144,
          resizeMode: "contain",
          backgroundColor: "#F3F6FC",
          dark: {
            image: "./assets/splash-icon-dark.png",
            backgroundColor: "#101827",
          },
        },
      ],
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "@react-native-firebase/crashlytics",
      "@react-native-firebase/messaging",
      "expo-notifications",
      "./plugins/withFacebookPrivacy",
      ...(facebookPlugin ? [facebookPlugin] : []),
    ],
  });
};
