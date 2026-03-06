import React, { createContext, useContext, ReactNode, useState, useCallback } from "react";
import { UpdateConfig } from "@/services/appUpdateService";

interface AppUpdateContextType {
  updateConfig: UpdateConfig | null;
  hasUpdate: boolean;
  isRequired: boolean;
  isLoading: boolean;
  isMaintenance: boolean;
  maintenanceMessage: string;
  showUpdateModal: boolean;
  setShowUpdateModal: (show: boolean) => void;
  showMaintenanceModal: boolean;
  setShowMaintenanceModal: (show: boolean) => void;
  checkForUpdate: () => Promise<void>;
  refresh: () => Promise<void>;
  openStore: () => Promise<void>;
}

const AppUpdateContext = createContext<AppUpdateContextType | undefined>(undefined);

interface AppUpdateProviderProps {
  children: ReactNode;
}

export const AppUpdateProvider: React.FC<AppUpdateProviderProps> = ({ children }) => {
  const [updateConfig, setUpdateConfig] = useState<UpdateConfig | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isRequired, setIsRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);

  // Verificar atualizações
  const checkForUpdate = useCallback(async () => {
    try {
      setIsLoading(true);

      const { AppUpdateService } = await import("@/services/appUpdateService");

      // Verificar modo de manutenção
      const maintenance = await AppUpdateService.checkMaintenanceMode();
      setIsMaintenance(maintenance.isMaintenance);
      setMaintenanceMessage(maintenance.message);

      if (maintenance.isMaintenance) {
        setShowMaintenanceModal(true);
        setIsLoading(false);
        return;
      }

      // Verificar atualizações
      const result = await AppUpdateService.checkForUpdate();
      setUpdateConfig(result.config);
      setHasUpdate(result.hasUpdate);
      setIsRequired(result.isRequired);

      // Mostrar modal de atualização se necessário
      if (result.isRequired) {
        setShowUpdateModal(true);
      } else if (result.hasUpdate) {
        // Para atualizações opcionais, podemos mostrar um banner ou modal
        // Por enquanto, não mostramos automaticamente
      }
    } catch (error) {
      console.error("Error checking for update:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Atualizar configuração do Remote Config
  const refresh = useCallback(async () => {
    try {
      const { AppUpdateService } = await import("@/services/appUpdateService");
      await AppUpdateService.refresh();
      await checkForUpdate();
    } catch (error) {
      console.error("Error refreshing update config:", error);
    }
  }, [checkForUpdate]);

  // Abrir a Play Store
  const openStore = useCallback(async () => {
    try {
      const { AppUpdateService } = await import("@/services/appUpdateService");
      const updateUrl = await AppUpdateService.getUpdateUrl();
      const { Linking } = await import("react-native");

      const canOpen = await Linking.canOpenURL(updateUrl);
      if (canOpen) {
        await Linking.openURL(updateUrl);
      } else {
        console.error("Cannot open URL:", updateUrl);
      }
    } catch (error) {
      console.error("Error opening store:", error);
    }
  }, []);

  // Verificar atualizações ao montar
  React.useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  const value: AppUpdateContextType = {
    updateConfig,
    hasUpdate,
    isRequired,
    isLoading,
    isMaintenance,
    maintenanceMessage,
    showUpdateModal,
    setShowUpdateModal,
    showMaintenanceModal,
    setShowMaintenanceModal,
    checkForUpdate,
    refresh,
    openStore,
  };

  return <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>;
};

export const useAppUpdateContext = (): AppUpdateContextType => {
  const context = useContext(AppUpdateContext);
  if (context === undefined) {
    throw new Error("useAppUpdateContext must be used within an AppUpdateProvider");
  }
  return context;
};
