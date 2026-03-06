import "./global.css";
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
import { AppUpdateProvider, useAppUpdateContext } from "@/context/AppUpdateContext";
import { useFirebase } from "@/hooks/useFirebase";
import { useNotifications } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";
import { UpdateRequiredModal } from "@/components/UpdateRequiredModal";
import { MaintenanceModal } from "@/components/MaintenanceModal";
import { GestureHandlerRootView } from "react-native-gesture-handler";

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
  // Initialize Firebase services
  useFirebase();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView>
        <SafeAreaProvider>
          <AuthContextProvider>
            <HouseProvider>
              <ScheduleProvider>
                <AppUpdateProvider>
                  <AppContent />
                  <AppUpdateManager />
                </AppUpdateProvider>
              </ScheduleProvider>
            </HouseProvider>
          </AuthContextProvider>
          <StatusBar style="light" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

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
