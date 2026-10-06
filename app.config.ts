import type { ExpoConfig, ConfigContext } from "expo/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveGoogleWebClientId } from "./src/utils/googleSignInConfig";

interface AppConfig extends ExpoConfig {
  extra: {
    eas: {
      projectId: string;
    };
    googleWebClientId?: string;
    googleIosClientId?: string;
    googleAndroidClientId?: string;
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

  return {
    ...config,
    name: "HomeCare",
    slug: "HomeCare",
    version: "2.6.0",
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
    splash: {
      image: "./assets/splash-icon-light.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
      dark: {
        image: "./assets/splash-icon-dark.png",
        backgroundColor: "#18181b",
      },
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.pedrorbc.HomeCare",
      // googleServicesFile: process.env.GOOGLE_SERVICES_PLIST || "./GoogleService-Info.plist",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        monochromeImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: androidPackage,
      googleServicesFile,
      allowBackup: false,
      blockedPermissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW",
      ],
    },
    extra: {
      eas: {
        projectId: "ae9c4bb2-594d-415e-ae20-40b270e257c1",
      },
      googleWebClientId,
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
    },
    plugins: [
      "expo-font",
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "@react-native-firebase/crashlytics",
      "@react-native-firebase/messaging",
      "expo-notifications",
    ],
  };
};
