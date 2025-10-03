import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { useColorScheme } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useHouse } from "@/context/HouseContext";
import { LoadingScreen } from "@/components/LoadingScreen";

import { MainAppRoutes } from "./main-app.routes";
import { AuthRoutes } from "./auth.routes";

// Export types for external use
export type {
	MainAppStackParamList,
	HouseManagementTabsParamList,
	CareManagementTabsParamList,
	AuthStackParamList,
} from "./types";

export function Routes() {
	const scheme = useColorScheme();
	const { user, loading: authLoading } = useAuth();
	const { isInitialized } = useHouse();

	// Show loading while auth or house data is loading
	if (authLoading || (user && !isInitialized)) {
		return <LoadingScreen />;
	}

	// Determine which route to show
	const getRouteComponent = () => {
		if (!user) {
			return <AuthRoutes />;
		}

		// If user is logged in, show main app (tabs will change based on house selection)
		return <MainAppRoutes />;
	};

	return (
		<NavigationContainer
			theme={scheme === "dark" ? DarkTheme : DefaultTheme}
			fallback={<LoadingScreen />}
		>
			{getRouteComponent()}
		</NavigationContainer>
	);
}
