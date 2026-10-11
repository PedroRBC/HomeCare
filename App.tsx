import "./global.css";
// Must load before any encryption code runs
import "@/services/secureRandom";
import "@/i18n";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";

import { SafeAreaProvider } from "react-native-safe-area-context";

import { StatusBar } from "expo-status-bar";
import { Routes } from "@/router";
import { ScheduleProvider, useSchedule } from "@/context/ScheduleContext";
import { AuthContextProvider } from "@/context/AuthContext";
import { HouseProvider } from "@/context/HouseContext";
import { CaregiverProvider } from "@/context/CaregiverContext";
import { AppUpdateProvider, useAppUpdateContext } from "@/context/AppUpdateContext";
import { useFirebase } from "@/hooks/useFirebase";
import { useNotifications } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";
import { UpdateRequiredModal } from "@/components/UpdateRequiredModal";
import { MaintenanceModal } from "@/components/MaintenanceModal";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { loadLanguagePreference, useDeviceLanguageSync } from "@/i18n/useLanguage";
import { AppThemeProvider, useAppTheme, useThemeLoaded } from "@/theme";
import * as SplashScreen from "expo-splash-screen";

void SplashScreen.preventAutoHideAsync().catch(() => {});

// Componente para gerenciar atualizações do app
const AppUpdateManager = () => {
  const {
    updateConfig,
    showUpdateModal,
    setShowUpdateModal,
    showMaintenanceModal,
    maintenanceMessage,
  } = useAppUpdateContext();

  return (
    <>
      <UpdateRequiredModal
        visible={showUpdateModal}
        config={updateConfig!}
        onDismiss={() => !updateConfig?.forceUpdate && setShowUpdateModal(false)}
      />
      <MaintenanceModal visible={showMaintenanceModal} message={maintenanceMessage} />
    </>
  );
};

export default function App() {
  return (
    <AppThemeProvider>
      <AppBootstrap />
    </AppThemeProvider>
  );
}

const AppBootstrap = () => {
  const { colors, scheme } = useAppTheme();
  const themeLoaded = useThemeLoaded();

  // Initialize Firebase services
  useFirebase();

  const [languageLoaded, setLanguageLoaded] = useState(false);
  useDeviceLanguageSync();

  useEffect(() => {
    loadLanguagePreference().finally(() => setLanguageLoaded(true));
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  if ((!fontsLoaded && !fontError) || !languageLoaded || !themeLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.background }}
      onLayout={() => {
        void SplashScreen.hideAsync().catch(() => {});
      }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <ErrorBoundary>
        <SafeAreaProvider>
          <AuthContextProvider>
            <HouseProvider>
              <CaregiverProvider>
                <ScheduleProvider>
                  <AppUpdateProvider>
                    <AppContent />
                    <AppUpdateManager />
                  </AppUpdateProvider>
                </ScheduleProvider>
              </CaregiverProvider>
            </HouseProvider>
          </AuthContextProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
};

const AppContent = () => {
  const { isLoading } = useSchedule();

  // Initialize notifications
  useNotifications();

  // Initialize push notifications
  usePushNotifications();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <Routes />;
};
