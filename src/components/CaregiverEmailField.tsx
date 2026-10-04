import React from "react";
import { View, Text, TextInput } from "react-native";
import { Card } from "@/components/Card";

type Props = { value: string; onChange: (email: string) => void; error: string | null };

export const CaregiverEmailField = ({ value, onChange, error }: Props) => (
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
          Com o email, a cuidadora entra no app e vê os próprios plantões desta casa.
        </Text>
      )}
    </View>
  </Card>
);
