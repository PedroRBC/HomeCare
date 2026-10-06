import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { useColorScheme, View, Text, Pressable } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useHouse } from "@/context/HouseContext";
import { useCaregiver } from "@/context/CaregiverContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useRef, useEffect } from "react";

import { MainAppRoutes } from "./main-app.routes";
import { AuthRoutes } from "./auth.routes";
import { AlertProvider, useAlert } from "@/context/AlertContext";
import { OnboardingScreen } from "@/screens/onboarding/OnboardingScreen";
import { ConsentRoutes } from "./consent.routes";
import { needsConsent } from "@/utils/privacy";
import { useTranslation } from "react-i18next";

// Export types for external use
export type {
  ConsentStackParamList,
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
      fallback={<LoadingScreen />}>
      {children}
    </NavigationContainer>
  );
}

export function Routes() {
  const {
    user,
    loading: authLoading,
    isNewUser,
    setIsNewUser,
    initializationError,
    retryInitialization,
    signOut,
  } = useAuth();
  const { t } = useTranslation();
  const { isInitialized } = useHouse();
  const { isLoading: caregiverLoading } = useCaregiver();

  if (initializationError && !authLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-900 p-6">
        <Text accessibilityRole="alert" className="mb-6 text-center text-zinc-200">
          {initializationError}
        </Text>
        <Pressable
          testID="auth-initialization-retry"
          onPress={retryInitialization}
          className="mb-3 rounded-lg bg-emerald-600 px-6 py-3">
          <Text className="text-white">{t("common.tryAgain")}</Text>
        </Pressable>
        <Pressable onPress={() => signOut().catch(() => {})} className="px-6 py-3">
          <Text className="text-zinc-300">{t("settings.logout")}</Text>
        </Pressable>
      </View>
    );
  }

  // Show loading while auth, house or caregiver data is loading
  if (authLoading || (user && (!isInitialized || caregiverLoading))) {
    return <LoadingScreen />;
  }

  // Consent comes before anything else (LGPD art. 8), also when the policy changes
  const consentPending = !!user && needsConsent(user.consents);

  // Show onboarding for newly registered users
  if (user && isNewUser && !consentPending) {
    return <OnboardingScreen onComplete={() => setIsNewUser(false)} />;
  }

  // Determine which route to show
  const getRouteComponent = () => {
    if (!user) {
      return <AuthRoutes />;
    }

    if (consentPending) {
      return <ConsentRoutes />;
    }

    // If user is logged in, show main app (tabs will change based on house selection)
    return <MainAppRoutes />;
  };

  return (
    <AlertProvider>
      <NavigationWrapper>{getRouteComponent()}</NavigationWrapper>
    </AlertProvider>
  );
}
