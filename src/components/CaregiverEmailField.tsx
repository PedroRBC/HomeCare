import React from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { Card } from "@/components/Card";
import { CaregiverLinkStatusBadge } from "@/components/CaregiverLinkStatusBadge";
import { linkStatus, normalizeEmail, type CaregiverLink } from "@/utils/caregiverShifts";

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
}: Props) => (
  <Card>
    <View className="gap-2">
      <Text className="font-subtitle text-sm text-zinc-200">Email da cuidadora (opcional)</Text>
      <TextInput
        testID="caregiver-email"
        className={`rounded-xl border bg-zinc-800 px-4 py-3 text-zinc-100 ${
          error ? "border-rose-500" : "border-zinc-700"
        }`}
        placeholder="Ex: maria@email.com"
        placeholderTextColor="#9CA3AF"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        onChangeText={onChange}
      />
      {error ? (
        <Text className="text-xs text-rose-400">{error}</Text>
      ) : (
        <Text className="text-xs text-zinc-500">
          A cuidadora recebe um convite no app e, ao aceitar, vê os próprios plantões desta casa.
        </Text>
      )}
      {link && normalizeEmail(value) === link.email && (
        <View className="flex-row items-center justify-between">
          <CaregiverLinkStatusBadge link={link} />
          {linkStatus(link) === "declined" && onResendInvitation && (
            <Pressable onPress={onResendInvitation} className="rounded-lg bg-zinc-700 px-3 py-1">
              <Text className="text-xs text-zinc-100">Reenviar convite</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  </Card>
);
