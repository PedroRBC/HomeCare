import React from "react";
import { View, Text } from "react-native";
import { linkStatus, type CaregiverLink } from "@/utils/caregiverShifts";

const LABELS = {
  pending: { text: "Convite pendente", className: "bg-amber-600/20", textClass: "text-amber-300" },
  accepted: { text: "Aceito", className: "bg-emerald-600/20", textClass: "text-emerald-300" },
  declined: { text: "Recusado", className: "bg-rose-600/20", textClass: "text-rose-300" },
} as const;

// Whether the caregiver accepted working at the house through her account
export const CaregiverLinkStatusBadge = ({ link }: { link?: CaregiverLink }) => {
  if (!link) return null;
  const label = LABELS[linkStatus(link)];
  return (
    <View testID="caregiver-link-status" className={`rounded px-2 py-0.5 ${label.className}`}>
      <Text className={`text-xs ${label.textClass}`}>{label.text}</Text>
    </View>
  );
};
