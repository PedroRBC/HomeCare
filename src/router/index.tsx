import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { useColorScheme } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";

import { AppRoutes } from "./app.routes";
import { AuthRoutes } from "./auth.routes";

export function Routes() {
	const scheme = useColorScheme();
	const { user, loading } = useAuth();

	if (loading) {
		return <LoadingScreen />;
	}

	return (
		<NavigationContainer
			theme={scheme === "dark" ? DarkTheme : DefaultTheme}
			fallback={<LoadingScreen />}
		>
			{user ? <AppRoutes /> : <AuthRoutes />}
		</NavigationContainer>
	);
}
