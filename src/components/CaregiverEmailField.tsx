import React from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { Card } from "@/components/Card";
import { CaregiverLinkStatusBadge } from "@/components/CaregiverLinkStatusBadge";
import { linkStatus, normalizeEmail, type CaregiverLink } from "@/utils/caregiverShifts";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/theme";

type Props = {
  value: string;
  onChange: (email: string) => void;
  error: string | null;
  // Saved link of the caregiver, absent while creating her
  link?: CaregiverLink;
  onResendInvitation?: () => void;
};

export const CaregiverEmailField = ({
  value,
  onChange,
  error,
  link,
  onResendInvitation,
}: Props) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return (
    <Card>
      <View className="gap-2">
        <Text className="font-subtitle text-content text-sm">{t("caregiverView.emailLabel")}</Text>
        <TextInput
          testID="caregiver-email"
          className={`bg-surface text-content rounded-xl border px-4 py-3 ${
            error ? "border-danger" : "border-divider"
          }`}
          placeholder={t("caregiverView.emailPlaceholder")}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={value}
          onChangeText={onChange}
        />
        {error ? (
          <Text className="text-danger text-xs">{error}</Text>
        ) : (
          <Text className="text-subtle text-xs">{t("caregiverView.emailHint")}</Text>
        )}
        {link && normalizeEmail(value) === link.email && (
          <View className="flex-row items-center justify-between">
            <CaregiverLinkStatusBadge link={link} />
            {linkStatus(link) === "declined" && onResendInvitation && (
              <Pressable
                onPress={onResendInvitation}
                className="bg-surface-raised rounded-lg px-3 py-1">
                <Text className="text-content text-xs">{t("caregiverView.resend")}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Card>
  );
};
