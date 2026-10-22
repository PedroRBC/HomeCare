import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { FacebookSignInToken } from "@/utils/facebookSignIn";
import { getFacebookSignInToken, isFacebookSignInAvailable } from "@/utils/facebookSignInNative";

interface FacebookSignInButtonProps {
  mode: "signin" | "link" | "reauth";
  onSuccess: (token: FacebookSignInToken) => Promise<void>;
  onError: (error: Error) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

const isCancellation = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; name?: string; message?: string };
  return [candidate.code, candidate.name, candidate.message]
    .filter(Boolean)
    .some((value) => /cancel(?:led|ed)|user.?abort/i.test(value as string));
};

export const FacebookSignInButton: React.FC<FacebookSignInButtonProps> = ({
  mode,
  onSuccess,
  onError,
  disabled = false,
  onBusyChange,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const isSigningIn = useRef(false);
  const mounted = useRef(true);
  const available = isFacebookSignInAvailable(mode);

  useEffect(() => {
    mounted.current = true;
    return () => {
      // SDK logout belongs to the auth lifecycle, not a disappearing button.
      mounted.current = false;
    };
  }, []);

  if (!available) return null;

  const handleFacebookSignIn = async () => {
    if (disabled || isSigningIn.current) return;
    isSigningIn.current = true;
    onBusyChange?.(true);

    try {
      setIsLoading(true);
      const token = await getFacebookSignInToken(mode);
      if (token !== null && mounted.current) await onSuccess(token);
    } catch (error) {
      if (mounted.current && !isCancellation(error)) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      isSigningIn.current = false;
      if (mounted.current) setIsLoading(false);
      // Linking replaces this button while the containing settings screen stays.
      onBusyChange?.(false);
    }
  };

  const buttonLabel = {
    signin: t("auth.facebook.signin"),
    link: t("auth.facebook.link"),
    reauth: t("auth.facebook.reauth"),
  }[mode];
  const busy = disabled || isLoading;

  return (
    <TouchableOpacity
      onPress={handleFacebookSignIn}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={buttonLabel}
      accessibilityState={{ disabled: busy, busy: isLoading }}
      className="w-full flex-row items-center justify-center rounded-lg bg-[#1877F2] py-3"
      style={{ opacity: busy ? 0.6 : 1 }}>
      {isLoading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <>
          <Ionicons name="logo-facebook" size={20} color="white" />
          <Text className="ml-2 text-base font-semibold text-white">{buttonLabel}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};
