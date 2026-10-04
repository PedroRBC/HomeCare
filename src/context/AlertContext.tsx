import React, { createContext, useContext, ReactNode, useRef, useCallback } from "react";
import { Alert } from "react-native";
import { AlertButton, AlertModalParams } from "@/screens/AlertModal";

interface AlertContextType {
  showAlert: (params: Omit<AlertModalParams, "buttons"> & { buttons: AlertButton[] }) => void;
  setNavigationRef: (ref: any) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

interface AlertProviderProps {
  children: ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const navigationRef = useRef<any>(null);

  const setNavigationRef = useCallback((ref: any) => {
    navigationRef.current = ref;
  }, []);

  const showAlert = useCallback(
    (params: Omit<AlertModalParams, "buttons"> & { buttons: AlertButton[] }) => {
      if (navigationRef.current) {
        navigationRef.current.navigate("AlertModal", params);
      } else {
        console.warn("Navigation not available for AlertModal, falling back to native Alert");
        // Fallback to native Alert if navigation is not available
        const nativeButtons = params.buttons.map((button) => ({
          text: button.text,
          style: (button.style === "destructive" ? "destructive" : "default") as
            | "default"
            | "cancel"
            | "destructive",
          onPress: button.onPress,
        }));
        Alert.alert(params.title, params.message, nativeButtons, {
          cancelable: true,
          onDismiss: params.onDismiss,
        });
      }
    },
    [],
  );

  const value: AlertContextType = {
    showAlert,
    setNavigationRef,
  };

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
};

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
};
