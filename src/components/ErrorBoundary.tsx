import React, { Component, ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { CrashlyticsService } from "@/services/firebase";
import { t as translate } from "i18next";

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
        <View className="bg-app flex-1 items-center justify-center px-6">
          <View className="border-divider bg-surface rounded-xl border p-6">
            <Text className="font-heading text-content mb-2 text-center text-xl">
              {translate("common.errorBoundary.title")}
            </Text>
            <Text className="text-muted mb-4 text-center text-sm">
              {translate("common.errorBoundary.message")}
            </Text>
            {__DEV__ && this.state.error && (
              <Text className="text-danger mb-4 text-center text-xs">
                {this.state.error.message}
              </Text>
            )}
            <Pressable onPress={this.handleRetry} className="bg-primary rounded-lg px-4 py-3">
              <Text className="font-subtitle text-on-primary text-center">
                {translate("common.tryAgain")}
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}
