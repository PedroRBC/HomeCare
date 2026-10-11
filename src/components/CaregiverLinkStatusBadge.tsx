import React from "react";
import { View, Text } from "react-native";
import { linkStatus, type CaregiverLink } from "@/utils/caregiverShifts";
import { useTranslation } from "react-i18next";

const LABELS = {
  pending: { key: "statusPending", className: "bg-warning-soft", textClass: "text-warning" },
  accepted: {
    key: "statusAccepted",
    className: "bg-success-soft",
    textClass: "text-success",
  },
  declined: { key: "statusDeclined", className: "bg-danger-soft", textClass: "text-danger" },
} as const;

// Whether the caregiver accepted working at the house through her account
export const CaregiverLinkStatusBadge = ({ link }: { link?: CaregiverLink }) => {
  const { t } = useTranslation();
  if (!link) return null;
  const label = LABELS[linkStatus(link)];
  return (
    <View testID="caregiver-link-status" className={`rounded px-2 py-0.5 ${label.className}`}>
      <Text className={`text-xs ${label.textClass}`}>{t(`caregiverView.${label.key}`)}</Text>
    </View>
  );
};
