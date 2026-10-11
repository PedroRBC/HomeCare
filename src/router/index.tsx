import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/theme";
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
  const { colors, scheme } = useAppTheme();
  const baseTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };

  useEffect(() => {
    if (navigationRef.current) {
      setNavigationRef(navigationRef.current);
    }
  }, [setNavigationRef]);

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} fallback={<LoadingScreen />}>
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
      <View className="bg-app flex-1 items-center justify-center p-6">
        <Text accessibilityRole="alert" className="text-content mb-6 text-center">
          {initializationError}
        </Text>
        <Pressable
          testID="auth-initialization-retry"
          onPress={retryInitialization}
          className="bg-primary mb-3 rounded-lg px-6 py-3">
          <Text className="text-on-primary">{t("common.tryAgain")}</Text>
        </Pressable>
        <Pressable onPress={() => signOut().catch(() => {})} className="px-6 py-3">
          <Text className="text-muted">{t("settings.logout")}</Text>
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
