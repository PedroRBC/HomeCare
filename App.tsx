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
import { configureFirebaseEmulators } from "@/services/firebaseEmulators";
import { useNotifications } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";
import { UpdateRequiredModal } from "@/components/UpdateRequiredModal";
import { MaintenanceModal } from "@/components/MaintenanceModal";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Text, View } from "react-native";
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

  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  // Configure local endpoints before rendering Auth/Firestore providers. In production,
  // the opt-in guard throws and this tree never reaches getAuth/getFirestore consumers.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const useEmulators = configureFirebaseEmulators();
        const firebaseServices = await import("@/services/firebase");
        if (useEmulators) await firebaseServices.disableTelemetryForLocalEmulators();
        else await firebaseServices.initializeFirebase();
        if (active) setFirebaseReady(true);
      } catch (error) {
        if (active) {
          setFirebaseError(error instanceof Error ? error.message : "Firebase bootstrap failed");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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

  if (firebaseError) {
    return (
      <View
        onLayout={() => {
          void SplashScreen.hideAsync().catch(() => {});
        }}
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 24,
          backgroundColor: colors.background,
        }}>
        <Text style={{ color: colors.text }}>Firebase bootstrap bloqueado: {firebaseError}</Text>
      </View>
    );
  }
  if (!firebaseReady || (!fontsLoaded && !fontError) || !languageLoaded || !themeLoaded) {
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
