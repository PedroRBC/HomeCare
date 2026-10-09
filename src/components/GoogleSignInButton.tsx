import React, { useRef, useState } from "react";
import { TouchableOpacity, ActivityIndicator, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { getGoogleIdToken } from "@/utils/googleSignIn";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";

interface GoogleSignInButtonProps {
  mode: "signin" | "link" | "reauth";
  onSuccess: (idToken: string) => Promise<void>;
  onError: (error: Error) => void;
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  mode,
  onSuccess,
  onError,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const isSigningIn = useRef(false);

  const handleGoogleSignIn = async () => {
    if (disabled || isSigningIn.current) return;
    isSigningIn.current = true;

    try {
      setIsLoading(true);
      const idToken = await getGoogleIdToken(GoogleSignin, {
        webClientId: Constants.expoConfig?.extra?.googleWebClientId,
        iosClientId: Constants.expoConfig?.extra?.googleIosClientId,
      });
      if (idToken !== null) await onSuccess(idToken);
    } catch (error) {
      const code = isErrorWithCode(error) ? error.code : undefined;
      if (code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the login flow
        return;
      } else if (code === statusCodes.IN_PROGRESS) {
        console.warn("Sign in is in progress already");
      } else if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        onError(new Error("Google Play Services not available"));
      } else {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      isSigningIn.current = false;
      setIsLoading(false);
    }
  };

  const buttonLabel = {
    signin: t("auth.google.signin"),
    link: t("auth.google.link"),
    reauth: t("auth.google.reauth"),
  }[mode];

  return (
    <TouchableOpacity
      onPress={handleGoogleSignIn}
      disabled={disabled || isLoading}
      className="w-full flex-row items-center justify-center rounded-lg bg-blue-600 py-3"
      style={{ opacity: disabled || isLoading ? 0.6 : 1 }}>
      {isLoading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <>
          <Ionicons name="logo-google" size={20} color="white" />
          <Text className="ml-2 text-base font-semibold text-white">{buttonLabel}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};
