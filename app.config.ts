import { ExpoConfig, ConfigContext } from "expo/config";

interface AppConfig extends ExpoConfig {
	extra: {
		eas: {
			projectId: string;
		};
	};
}

export default ({ config }: ConfigContext): AppConfig => ({
	...config,
	name: "HomeCare",
	slug: "HomeCare",
	version: "2.0.6",
	web: {
		favicon: "./assets/favicon.png",
	},
	experiments: {
		tsconfigPaths: true,
	},
	orientation: "portrait",
	icon: "./assets/icon.png",
	userInterfaceStyle: "automatic",
	splash: {
		image: "./assets/splash-icon-light.png",
		resizeMode: "contain",
		backgroundColor: "#ffffff",
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
		package: "com.pedrorbc.HomeCare",
		googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
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
	},
	plugins: [
		"expo-font",
		"@react-native-firebase/app",
		"@react-native-firebase/auth",
		"@react-native-firebase/crashlytics",
		[
			"expo-notifications",
			{
				icon: "./assets/notification-icon.png",
				color: "#ffffff",
				defaultChannel: "default",
			},
		],
	],
});
