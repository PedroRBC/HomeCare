import remoteConfig from "@react-native-firebase/remote-config";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Tipo de atualização
export type UpdateType = "optional" | "required" | "none";

// Configuração de atualização
export interface UpdateConfig {
  minimumVersion: string;
  currentVersion: string;
  latestVersion: string;
  updateType: UpdateType;
  updateMessage: string;
  forceUpdate: boolean;
  updateUrl?: string;
  releaseNotes?: string;
}

// Valores padrão para o Remote Config
const DEFAULT_REMOTE_CONFIG = {
  minimum_android_version: "2.0.0",
  minimum_ios_version: "2.0.0",
  latest_android_version: "2.1.0",
  latest_ios_version: "2.1.0",
  force_update_android: false,
  force_update_ios: false,
  update_message:
    "Uma nova versão do HomeCare está disponível. Atualize para continuar usando o app.",
  optional_update_message: "Uma nova versão do HomeCare está disponível com melhorias e correções.",
  update_url_android: "",
  update_url_ios: "",
  release_notes: "",
  maintenance_mode: false,
  maintenance_message:
    "O HomeCare está em manutenção. Por favor, tente novamente em alguns minutos.",
};

export class AppUpdateService {
  private static isInitialized = false;
  private static currentUpdateConfig: UpdateConfig | null = null;

  // Inicializar o Remote Config
  static async initialize(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.isInitialized) {
        return { success: true };
      }

      // Configurar o Remote Config
      await remoteConfig().setDefaults(DEFAULT_REMOTE_CONFIG);

      // Para desenvolvimento, usar cache curto
      // Para produção, usar cache maior (12 horas)
      const cacheDuration = __DEV__ ? 60 : 60 * 60 * 12; // 1 min (dev) ou 12 horas (prod)

      await remoteConfig().fetch(cacheDuration);
      await remoteConfig().activate();

      this.isInitialized = true;
      console.log("Remote Config initialized successfully");

      return { success: true };
    } catch (error) {
      console.error("Error initializing Remote Config:", error);
      return { success: false, error: String(error) };
    }
  }

  // Obter a versão atual do app
  static getCurrentVersion(): string {
    return Constants.expoConfig?.version || "2.1.0";
  }

  // Comparar versões
  private static compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split(".").map(Number);
    const v2Parts = version2.split(".").map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0;
  }

  // Obter configuração de atualização
  static async getUpdateConfig(): Promise<UpdateConfig> {
    try {
      // Garantir que o Remote Config está inicializado
      if (!this.isInitialized) {
        await this.initialize();
      }

      const currentVersion = this.getCurrentVersion();
      const isAndroid = Platform.OS === "android";

      // Obter valores do Remote Config
      const minimumVersion =
        remoteConfig()
          .getValue(isAndroid ? "minimum_android_version" : "minimum_ios_version")
          .asString() || DEFAULT_REMOTE_CONFIG.minimum_android_version;

      const latestVersion =
        remoteConfig()
          .getValue(isAndroid ? "latest_android_version" : "latest_ios_version")
          .asString() || DEFAULT_REMOTE_CONFIG.latest_android_version;

      const forceUpdate =
        remoteConfig()
          .getValue(isAndroid ? "force_update_android" : "force_update_ios")
          .asBoolean() || DEFAULT_REMOTE_CONFIG.force_update_android;

      const updateUrl =
        remoteConfig()
          .getValue(isAndroid ? "update_url_android" : "update_url_ios")
          .asString() || DEFAULT_REMOTE_CONFIG.update_url_android;

      const releaseNotes =
        remoteConfig().getValue("release_notes").asString() || DEFAULT_REMOTE_CONFIG.release_notes;

      // Determinar o tipo de atualização
      let updateType: UpdateType = "none";

      const versionComparison = this.compareVersions(currentVersion, minimumVersion);
      const latestComparison = this.compareVersions(currentVersion, latestVersion);

      if (versionComparison < 0) {
        // Versão atual é menor que a mínima -> atualização obrigatória
        updateType = forceUpdate ? "required" : "optional";
      } else if (latestComparison < 0) {
        // Versão atual é menor que a última -> atualização opcional
        updateType = "optional";
      }

      const updateConfig: UpdateConfig = {
        minimumVersion,
        currentVersion,
        latestVersion,
        updateType,
        updateMessage:
          updateType === "required"
            ? DEFAULT_REMOTE_CONFIG.update_message
            : DEFAULT_REMOTE_CONFIG.optional_update_message,
        forceUpdate: updateType === "required",
        updateUrl: updateUrl || undefined,
        releaseNotes: releaseNotes || undefined,
      };

      this.currentUpdateConfig = updateConfig;

      console.log("Update config:", updateConfig);
      return updateConfig;
    } catch (error) {
      console.error("Error getting update config:", error);

      // Retornar configuração padrão em caso de erro
      return {
        minimumVersion: DEFAULT_REMOTE_CONFIG.minimum_android_version,
        currentVersion: this.getCurrentVersion(),
        latestVersion: DEFAULT_REMOTE_CONFIG.latest_android_version,
        updateType: "none",
        updateMessage: DEFAULT_REMOTE_CONFIG.optional_update_message,
        forceUpdate: false,
      };
    }
  }

  // Verificar se há atualização disponível
  static async checkForUpdate(): Promise<{
    hasUpdate: boolean;
    isRequired: boolean;
    config: UpdateConfig;
  }> {
    try {
      const config = await this.getUpdateConfig();

      return {
        hasUpdate: config.updateType !== "none",
        isRequired: config.updateType === "required",
        config,
      };
    } catch (error) {
      console.error("Error checking for update:", error);
      return {
        hasUpdate: false,
        isRequired: false,
        config: {
          minimumVersion: DEFAULT_REMOTE_CONFIG.minimum_android_version,
          currentVersion: this.getCurrentVersion(),
          latestVersion: DEFAULT_REMOTE_CONFIG.latest_android_version,
          updateType: "none",
          updateMessage: DEFAULT_REMOTE_CONFIG.optional_update_message,
          forceUpdate: false,
        },
      };
    }
  }

  // Verificar se o app está em modo de manutenção
  static async checkMaintenanceMode(): Promise<{
    isMaintenance: boolean;
    message: string;
  }> {
    try {
      // Garantir que o Remote Config está inicializado
      if (!this.isInitialized) {
        await this.initialize();
      }

      const isMaintenance = remoteConfig().getValue("maintenance_mode").asBoolean();
      const message =
        remoteConfig().getValue("maintenance_message").asString() ||
        DEFAULT_REMOTE_CONFIG.maintenance_message;

      return {
        isMaintenance,
        message,
      };
    } catch (error) {
      console.error("Error checking maintenance mode:", error);
      return {
        isMaintenance: false,
        message: "",
      };
    }
  }

  // Obter URL da Play Store para atualização
  static getPlayStoreUrl(): string {
    return "https://play.google.com/store/apps/details?id=com.pedrorbc.HomeCare";
  }

  // Obter URL de atualização customizada (se configurada)
  static async getUpdateUrl(): Promise<string> {
    const config = await this.getUpdateConfig();
    return config.updateUrl || this.getPlayStoreUrl();
  }

  // Forçar refresh do Remote Config
  static async refresh(): Promise<{ success: boolean; error?: string }> {
    try {
      const cacheDuration = __DEV__ ? 0 : 60; // Imediato em dev, 1 min em prod
      await remoteConfig().fetch(cacheDuration);
      await remoteConfig().activate();

      this.isInitialized = true;
      console.log("Remote Config refreshed successfully");

      return { success: true };
    } catch (error) {
      console.error("Error refreshing Remote Config:", error);
      return { success: false, error: String(error) };
    }
  }
}
