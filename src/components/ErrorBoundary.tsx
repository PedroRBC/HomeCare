import React, { Component, ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { CrashlyticsService } from "@/services/firebase";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error to Crashlytics
    CrashlyticsService.logError(error, `ErrorBoundary: ${errorInfo.componentStack}`);
    CrashlyticsService.setAttribute("error_boundary", "true");
    CrashlyticsService.setAttribute("error_message", error.message);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className="flex-1 items-center justify-center bg-zinc-900 px-6">
          <View className="rounded-xl border border-zinc-700 bg-zinc-800 p-6">
            <Text className="font-heading mb-2 text-center text-xl text-white">
              Oops! Algo deu errado
            </Text>
            <Text className="mb-4 text-center text-sm text-zinc-400">
              Ocorreu um erro inesperado. Nossa equipe foi notificada.
            </Text>
            {__DEV__ && this.state.error && (
              <Text className="mb-4 text-center text-xs text-red-400">
                {this.state.error.message}
              </Text>
            )}
            <Pressable onPress={this.handleRetry} className="rounded-lg bg-emerald-600 px-4 py-3">
              <Text className="font-subtitle text-center text-white">Tentar Novamente</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}
