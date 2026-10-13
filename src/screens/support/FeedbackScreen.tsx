import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { nativeApplicationVersion, nativeBuildVersion } from "expo-application";
import { randomUUID } from "expo-crypto";
import { getAuth } from "@react-native-firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { useAlert } from "@/context/AlertContext";
import { useAuth } from "@/context/AuthContext";
import { useFormValidation } from "@/hooks/useFormValidation";
import { currentLanguage } from "@/i18n";
import {
  reportDraftSchema,
  REPORT_LIMITS,
  type ReportDraft,
  type ReportContext,
} from "@/feedback/report";
import { submitFeedbackReport } from "@/services/feedbackReports";
import { useAppTheme } from "@/theme";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainAppStackParamList } from "@/router/types";

const EMPTY_DRAFT: ReportDraft = {
  type: "feedback",
  title: "",
  description: "",
  steps: "",
  expected: "",
  actual: "",
};

type FeedbackScreenProps = NativeStackScreenProps<MainAppStackParamList, "Feedback">;

export const FeedbackScreen: React.FC<FeedbackScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const form = useFormValidation<ReportDraft>({
    schema: reportDraftSchema as any,
    initialValues: EMPTY_DRAFT,
  });
  const { reset } = form;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const identityRef = useRef<string | null>(user?.uid ?? null);
  const requestRef = useRef(0);
  const attemptRef = useRef<{
    uid: string;
    key: string;
    id: string;
    context: ReportContext;
  } | null>(null);
  identityRef.current = user?.uid ?? null;

  useEffect(() => {
    requestRef.current++;
    inFlight.current = false;
    attemptRef.current = null;
    setIsSubmitting(false);
    setSuccessId(null);
    reset();
    const request = requestRef;
    return () => {
      request.current++;
    };
  }, [user?.uid, reset]);

  const fieldError = (field: keyof ReportDraft) => {
    const error = form.errors.find((item) => item.field === field);
    return error ? t(error.message) : null;
  };

  const submit = async () => {
    const uid = user?.uid;
    if (!uid || inFlight.current || !form.validate()) return;

    let draft: ReportDraft;
    try {
      draft = reportDraftSchema.parse(form.values);
    } catch {
      return;
    }

    const requestId = ++requestRef.current;
    const attemptKey = JSON.stringify(draft);
    if (
      !attemptRef.current ||
      attemptRef.current.uid !== uid ||
      attemptRef.current.key !== attemptKey
    ) {
      attemptRef.current = {
        uid,
        key: attemptKey,
        id: randomUUID(),
        context: {
          appVersion: nativeApplicationVersion ?? null,
          appBuild: nativeBuildVersion ?? null,
          platform: Platform.OS,
          osVersion: String(Platform.Version),
          language: currentLanguage(),
        },
      };
    }
    const reportId = attemptRef.current.id;
    inFlight.current = true;
    setIsSubmitting(true);
    setSuccessId(null);

    try {
      const context = attemptRef.current.context;
      const confirmedId = await submitFeedbackReport(draft, context, reportId, uid);
      if (
        requestRef.current !== requestId ||
        identityRef.current !== uid ||
        getAuth().currentUser?.uid !== uid
      )
        return;
      form.reset();
      attemptRef.current = null;
      setSuccessId(confirmedId);
    } catch {
      if (
        requestRef.current === requestId &&
        identityRef.current === uid &&
        getAuth().currentUser?.uid === uid
      ) {
        showAlert({
          title: t("feedback.errorTitle"),
          message: t("feedback.errorMessage"),
          icon: "alert-circle",
          iconColor: colors.danger,
          buttons: [{ text: t("common.ok"), style: "default" }],
        });
      }
    } finally {
      if (requestRef.current === requestId) {
        inFlight.current = false;
        setIsSubmitting(false);
      }
    }
  };

  const renderField = (
    field: "title" | "description" | "steps" | "expected" | "actual",
    labelKey: string,
    placeholderKey: string,
    maxLength: number,
    multiline = false,
  ) => {
    const error = fieldError(field);
    const value = form.values[field];
    return (
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="font-subtitle text-content text-sm">{t(labelKey)}</Text>
          <Text className="text-subtle text-xs">
            {value.length}/{maxLength}
          </Text>
        </View>
        <TextInput
          accessibilityLabel={t(labelKey)}
          editable={!isSubmitting && !successId}
          value={value}
          onChangeText={(text) => {
            form.setValue(field, text);
            setSuccessId(null);
          }}
          placeholder={t(placeholderKey)}
          placeholderTextColor={colors.textMuted}
          maxLength={maxLength}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          className={`border-divider bg-surface text-content rounded-xl border px-4 py-3 ${multiline ? "min-h-[112px]" : ""}`}
          style={{ color: colors.text, opacity: isSubmitting || successId ? 0.65 : 1 }}
        />
        {error && <Text className="text-danger text-sm">{error}</Text>}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      className="bg-app flex-1"
      behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          paddingTop: topInset + 8,
          paddingBottom: bottomInset + 28,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("feedback.back")}
          onPress={() => navigation.goBack()}
          className="bg-surface mb-2 h-10 w-10 items-center justify-center rounded-full">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        <View className="mb-1">
          <Text className="font-heading text-content mb-1 text-2xl">{t("feedback.title")}</Text>
          <Text className="text-muted">{t("feedback.subtitle")}</Text>
        </View>

        {successId && (
          <Card variant="outlined" className="border-success">
            <View className="flex-row items-start gap-3">
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <View className="flex-1">
                <Text className="font-subtitle text-content">{t("feedback.successTitle")}</Text>
                <Text className="text-muted mt-1">
                  {t("feedback.successMessage", { id: successId })}
                </Text>
              </View>
            </View>
          </Card>
        )}

        <Card variant="elevated">
          <View className="gap-5">
            <View className="gap-2">
              <Text className="font-subtitle text-content text-sm">{t("feedback.typeLabel")}</Text>
              <View accessibilityRole="radiogroup" className="flex-row gap-2">
                {(["feedback", "bug"] as const).map((type) => {
                  const selected = form.values.type === type;
                  return (
                    <Pressable
                      key={type}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, checked: selected }}
                      disabled={isSubmitting || Boolean(successId)}
                      onPress={() => {
                        form.setValue("type", type);
                        setSuccessId(null);
                      }}
                      className={`flex-1 items-center rounded-xl border px-3 py-3 ${selected ? "border-primary bg-primary-soft" : "border-divider bg-surface"}`}>
                      <Text
                        className={`font-subtitle text-center text-sm ${selected ? "text-content" : "text-muted"}`}>
                        {t(type === "feedback" ? "feedback.typeFeedback" : "feedback.typeBug")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {renderField(
              "title",
              "feedback.titleLabel",
              "feedback.titlePlaceholder",
              REPORT_LIMITS.title,
            )}
            {renderField(
              "description",
              "feedback.descriptionLabel",
              "feedback.descriptionPlaceholder",
              REPORT_LIMITS.description,
              true,
            )}
            {form.values.type === "bug" && (
              <>
                {renderField(
                  "steps",
                  "feedback.stepsLabel",
                  "feedback.stepsPlaceholder",
                  REPORT_LIMITS.steps,
                  true,
                )}
                {renderField(
                  "expected",
                  "feedback.expectedLabel",
                  "feedback.expectedPlaceholder",
                  REPORT_LIMITS.expected,
                  true,
                )}
                {renderField(
                  "actual",
                  "feedback.actualLabel",
                  "feedback.actualPlaceholder",
                  REPORT_LIMITS.actual,
                  true,
                )}
              </>
            )}
          </View>
        </Card>

        <Card variant="outlined">
          <View className="flex-row items-start gap-3">
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
            <Text className="text-muted flex-1 text-sm">{t("feedback.privacyNote")}</Text>
          </View>
        </Card>

        {!user?.uid && (
          <Text className="text-muted text-center">{t("feedback.signInRequired")}</Text>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={!user?.uid || isSubmitting || Boolean(successId)}
          onPress={submit}
          className={`flex-row items-center justify-center gap-2 rounded-xl px-6 py-4 ${!user?.uid || isSubmitting || successId ? "bg-disabled" : "bg-primary"}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
          {isSubmitting && <Ionicons name="sync" size={20} color={colors.onPrimary} />}
          <Text
            className={`font-subtitle ${!user?.uid || isSubmitting || successId ? "text-muted" : "text-on-primary"}`}>
            {isSubmitting ? t("feedback.sending") : t("feedback.submit")}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
