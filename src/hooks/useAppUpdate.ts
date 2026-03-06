import { useEffect, useState, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { UpdateConfig, AppUpdateService } from "@/services/appUpdateService";

interface UseAppUpdateReturn {
  updateConfig: UpdateConfig | null;
  hasUpdate: boolean;
  isRequired: boolean;
  isLoading: boolean;
  isMaintenance: boolean;
  maintenanceMessage: string;
  checkForUpdate: () => Promise<void>;
  refresh: () => Promise<void>;
  openStore: () => Promise<void>;
}

export const useAppUpdate = (): UseAppUpdateReturn => {
  const [updateConfig, setUpdateConfig] = useState<UpdateConfig | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isRequired, setIsRequired] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  // Verificar atualizações
  const checkForUpdate = useCallback(async () => {
    try {
      setIsLoading(true);

      // Verificar modo de manutenção
      const maintenance = await AppUpdateService.checkMaintenanceMode();
      setIsMaintenance(maintenance.isMaintenance);
      setMaintenanceMessage(maintenance.message);

      // Se estiver em manutenção, não verificar atualizações
      if (maintenance.isMaintenance) {
        setIsLoading(false);
        return;
      }

      // Verificar atualizações
      const result = await AppUpdateService.checkForUpdate();
      setUpdateConfig(result.config);
      setHasUpdate(result.hasUpdate);
      setIsRequired(result.isRequired);
    } catch (error) {
      console.error("Error checking for update:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Atualizar configuração do Remote Config
  const refresh = useCallback(async () => {
    try {
      await AppUpdateService.refresh();
      await checkForUpdate();
    } catch (error) {
      console.error("Error refreshing update config:", error);
    }
  }, [checkForUpdate]);

  // Abrir a Play Store
  const openStore = useCallback(async () => {
    try {
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
  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  // Verificar atualizações quando o app voltar para foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        // Verificar atualizações com um pequeno delay para evitar chamadas excessivas
        const timeoutId = setTimeout(() => {
          checkForUpdate();
        }, 1000);

        return () => clearTimeout(timeoutId);
      }
    });

    return () => subscription?.remove();
  }, [checkForUpdate]);

  return {
    updateConfig,
    hasUpdate,
    isRequired,
    isLoading,
    isMaintenance,
    maintenanceMessage,
    checkForUpdate,
    refresh,
    openStore,
  };
};
