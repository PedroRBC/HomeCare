import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { useColorScheme } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useHouse } from "@/context/HouseContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useRef, useEffect } from "react";

import { MainAppRoutes } from "./main-app.routes";
import { AuthRoutes } from "./auth.routes";
import { AlertProvider, useAlert } from "@/context/AlertContext";

// Export types for external use
export type {
	MainAppStackParamList,
	HouseManagementTabsParamList,
	CareManagementTabsParamList,
	AuthStackParamList,
} from "./types";

function NavigationWrapper({ children }: { children: React.ReactNode }) {
	const navigationRef = useRef<any>(null);
	const { setNavigationRef } = useAlert();

	useEffect(() => {
		if (navigationRef.current) {
			setNavigationRef(navigationRef.current);
		}
	}, [setNavigationRef]);

	return (
		<NavigationContainer
			ref={navigationRef}
			theme={useColorScheme() === "dark" ? DarkTheme : DefaultTheme}
			fallback={<LoadingScreen />}
		>
			{children}
		</NavigationContainer>
	);
}

export function Routes() {
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
		<AlertProvider>
			<NavigationWrapper>
				{getRouteComponent()}
			</NavigationWrapper>
		</AlertProvider>
	);
}
