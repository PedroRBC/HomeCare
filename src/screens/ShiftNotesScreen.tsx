import React, { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useHouse } from "@/context/HouseContext";
import { useCaregiver } from "@/context/CaregiverContext";
import { useAlert } from "@/context/AlertContext";
import type { DaySchedule } from "@/context/ScheduleContext";
import type { MainAppStackParamList } from "@/router/types";
import { useAppTheme } from "@/theme";
import { formatDate } from "@/i18n/format";
import { parseCalendarDate } from "@/utils/date";
import {
  notePayloadSchema,
  previousScheduledShift,
  shiftContextSchema,
  type NotePayload,
  type ShiftContext,
  type ShiftNote,
} from "@/utils/shiftNotes";
import { FirestoreService } from "@/services/firestore";
import { getNoteKey, NoteConflictError, ShiftNotesService } from "@/services/shiftNotes";

const emptyHandover: NotePayload = {
  kind: "handover",
  medication: false,
  meals: false,
  activities: false,
  pending: [],
  observations: "",
};

function Notes({ context }: { context: ShiftContext }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { userHouses } = useHouse();
  const { acceptedLinks } = useCaregiver();
  const { showAlert } = useAlert();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [schedule, setSchedule] = useState<Record<string, Partial<DaySchedule>> | null>(null);
  const scheduleReady = useRef(false);
  const [key, setKey] = useState<Uint8Array | null>(null);
  const [clinicalKey, setClinicalKey] = useState<Uint8Array | null>(null);
  const [notes, setNotes] = useState<ShiftNote[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [sectionProblems, setSectionProblems] = useState<Record<string, number>>({});
  const [sectionConfirmed, setSectionConfirmed] = useState<Record<string, boolean>>({});
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<NotePayload>({ kind: "message", text: "" });
  const [editing, setEditing] = useState<ShiftNote | undefined>();
  const current = `${context.date}:${context.shift}`;
  const scheduledPrevious = schedule ? previousScheduledShift(schedule, current) : null;
  const previous = notes?.find((note) => note.shiftKey < current)?.shiftKey ?? scheduledPrevious;
  const previousHandovers =
    notes?.filter((note) => note.shiftKey === previous && note.payload.kind === "handover") ?? [];
  const member = userHouses.some((house) => house.id === context.houseId);
  const readLinkId = acceptedLinks.find(
    (link) => link.houseId === context.houseId && !link.disabled,
  )?.id;
  const clinical = !!readLinkId;
  const day = schedule?.[context.date];
  const assigned = [...(day?.[context.shift] ?? []), ...(day?.[`${context.shift}Extra`] ?? [])];
  const handoverLink = acceptedLinks.find(
    (link) =>
      link.houseId === context.houseId &&
      !link.disabled &&
      assigned.includes(link.caregiverId) &&
      (editing?.payload.kind !== "handover" || editing.caregiverId === link.caregiverId),
  );
  const canHandover = !!handoverLink;
  const ownHandover = notes?.find(
    (note) =>
      note.shiftKey === current && note.authorUid === user?.uid && note.payload.kind === "handover",
  );
  const currentHandoversReady =
    sectionConfirmed.handovers === true && (sectionProblems.handovers === 0 || !!ownHandover);
  const currentSectionsEmpty =
    sectionConfirmed.messages === true &&
    sectionProblems.messages === 0 &&
    (!clinical || (sectionConfirmed.handovers === true && sectionProblems.handovers === 0));

  useEffect(() => {
    if (!user) return;
    let active = true;
    scheduleReady.current = false;
    setLoadError(false);
    setNotes(null);
    setSchedule(null);
    setKey(null);
    setClinicalKey(null);
    const fail = () => {
      if (active) {
        setLoadError(true);
        setNotes(null);
      }
    };
    const updateSchedule = (value: Record<string, Partial<DaySchedule>>) => {
      if (active) {
        scheduleReady.current = true;
        setSchedule(value);
      }
    };
    const unsubscribe = readLinkId
      ? FirestoreService.subscribeToHouseSchedule(
          context.houseId,
          { userId: user.uid, linkId: readLinkId },
          updateSchedule,
          fail,
        )
      : ShiftNotesService.subscribeSchedule(context.houseId, updateSchedule, fail);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [context.houseId, user, retry, readLinkId]);

  useEffect(() => {
    if (!user || !schedule || !scheduleReady.current) return;
    let active = true;
    const parts = new Map<string, ShiftNote[]>();
    const failed = new Set<string>();
    const unsubscribes: (() => void)[] = [];
    setNotes(null);
    setKey(null);
    setClinicalKey(null);
    setSectionProblems(clinical ? { messages: -2, handovers: -2, previous: -2 } : { messages: -2 });
    setSectionConfirmed({});
    const publish = () => {
      setNotes(
        [...parts.values()]
          .flat()
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
      );
    };
    const update = (id: string) => (value: ShiftNote[], unreadable: number, confirmed: boolean) => {
      if (!active || failed.has(id)) return;
      parts.set(id, value);
      setSectionProblems((current) => ({ ...current, [id]: unreadable }));
      setSectionConfirmed((current) => ({ ...current, [id]: confirmed }));
      publish();
    };
    const fail = (id: string) => () => {
      if (!active) return;
      failed.add(id);
      parts.set(id, []);
      setSectionProblems((current) => ({ ...current, [id]: -1 }));
      publish();
    };
    getNoteKey(context.houseId, user.uid)
      .then((messageKey) => {
        if (!active) return;
        setKey(messageKey);
        unsubscribes.push(
          ShiftNotesService.subscribe(
            context.houseId,
            current,
            "message",
            messageKey,
            update("messages"),
            fail("messages"),
          ),
        );
      })
      .catch(fail("messages"));
    if (clinical) {
      getNoteKey(context.houseId, user.uid, true)
        .then((handoverKey) => {
          if (!active) return;
          setClinicalKey(handoverKey);
          unsubscribes.push(
            ShiftNotesService.subscribe(
              context.houseId,
              current,
              "handover",
              handoverKey,
              update("handovers"),
              fail("handovers"),
            ),
            ShiftNotesService.subscribePrevious(
              context.houseId,
              current,
              scheduledPrevious,
              handoverKey,
              update("previous"),
              fail("previous"),
            ),
          );
        })
        .catch(() => {
          fail("handovers")();
          fail("previous")();
        });
    }
    return () => {
      active = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [context.houseId, current, scheduledPrevious, clinical, schedule, user, retry, readLinkId]);

  const reset = () => {
    setEditing(undefined);
    setDraft({ kind: "message", text: "" });
  };
  const reportError = (error: unknown) =>
    showAlert({
      title: t("common.error"),
      message: t(
        error instanceof NoteConflictError ? "shiftNotes.conflict" : "shiftNotes.saveError",
      ),
      buttons: [{ text: t("common.ok") }],
    });
  const save = async () => {
    const draftKey = draft.kind === "handover" ? clinicalKey : key;
    if (
      !draftKey ||
      !user ||
      busy ||
      (draft.kind === "handover" && (!canHandover || !currentHandoversReady))
    )
      return;
    const parsed = notePayloadSchema.safeParse({
      ...draft,
      authorName: (user.displayName || t("shiftNotes.team")).slice(0, 200),
    });
    if (!parsed.success) {
      showAlert({
        title: t("common.error"),
        message: t("shiftNotes.invalid"),
        buttons: [{ text: t("common.ok") }],
      });
      return;
    }
    setBusy(true);
    try {
      await ShiftNotesService.save(
        context,
        user.uid,
        draftKey,
        parsed.data,
        parsed.data.kind === "handover" ? handoverLink!.id : null,
        editing,
      );
      reset();
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  };
  const remove = (note: ShiftNote) =>
    showAlert({
      title: t("shiftNotes.deleteTitle"),
      message: t("shiftNotes.deleteConfirm"),
      buttons: [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("shiftNotes.delete"),
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await ShiftNotesService.remove(context.houseId, note);
              if (editing?.id === note.id) reset();
            } catch (error) {
              reportError(error);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    });
  const button = (label: string, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="bg-surface-raised min-h-[48px] justify-center rounded-xl px-4 py-3"
      style={{ opacity: disabled ? 0.5 : 1 }}>
      <Text className="text-content font-subtitle">{label}</Text>
    </Pressable>
  );
  const field = (
    label: string,
    value: string,
    change: (value: string) => void,
    maxLength: number,
  ) => (
    <View className="gap-2">
      <Text className="text-content font-subtitle">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        multiline
        maxLength={maxLength}
        editable={!busy}
        textAlignVertical="top"
        className="bg-surface border-divider text-content min-h-[96px] rounded-xl border px-3 py-3"
        placeholderTextColor={colors.textSecondary}
      />
      <Text className="text-muted text-right text-xs">
        {value.length}/{maxLength}
      </Text>
    </View>
  );
  const renderNote = (note: ShiftNote, prior = false) => (
    <View key={note.id} className="border-divider gap-3 border-b py-4">
      <Text className="text-content font-subtitle">
        {note.authorUid === user?.uid
          ? t("shiftNotes.you")
          : note.payload.authorName || t("shiftNotes.team")}{" "}
        · {t(`shiftNotes.${note.payload.kind}`)}
      </Text>
      {!!note.createdAt && (
        <Text className="text-muted text-xs">
          {formatDate(new Date(note.createdAt), {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      )}
      {note.payload.kind === "message" ? (
        <Text selectable className="text-content text-base">
          {note.payload.text}
        </Text>
      ) : (
        <>
          {(["medication", "meals", "activities"] as const).map((item) => (
            <Text key={item} className="text-content">
              {t(`shiftNotes.${item}`)}:{" "}
              {t(
                note.payload.kind === "handover" && note.payload[item]
                  ? "shiftNotes.done"
                  : "shiftNotes.notRecorded",
              )}
            </Text>
          ))}
          {note.payload.pending.length > 0 && (
            <View className="gap-2">
              <Text className="text-content font-subtitle">
                {t("shiftNotes.pending")} ·{" "}
                {Object.values(note.pendingStatus).filter((status) => status === "done").length}/
                {note.payload.pending.length}
              </Text>
              {note.payload.pending.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={item.text}
                  accessibilityState={{
                    checked: note.pendingStatus[item.id] === "done",
                    disabled: busy || !prior || !canHandover,
                  }}
                  disabled={busy || !prior || !canHandover}
                  onPress={async () => {
                    if (!user) return;
                    setBusy(true);
                    try {
                      await ShiftNotesService.resolve(
                        context,
                        user.uid,
                        note,
                        item.id,
                        note.pendingStatus[item.id] === "done" ? "open" : "done",
                        handoverLink!.id,
                      );
                    } catch (error) {
                      reportError(error);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="min-h-[48px] flex-row items-center gap-3 py-2">
                  <Ionicons
                    name={note.pendingStatus[item.id] === "done" ? "checkbox" : "square-outline"}
                    size={24}
                    color={colors.accent}
                  />
                  <Text className="text-content flex-1">{item.text}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {!!note.payload.observations && (
            <Text selectable className="text-content">
              {t("shiftNotes.observations")}: {note.payload.observations}
            </Text>
          )}
        </>
      )}
      {!prior && (
        <View className="flex-row flex-wrap gap-2">
          {note.authorUid === user?.uid &&
            button(
              t("shiftNotes.edit"),
              () => {
                if (note.payload.kind === "handover" && !currentHandoversReady) return;
                setEditing(note);
                setDraft(note.payload);
              },
              busy || (note.payload.kind === "handover" && !currentHandoversReady),
            )}
          {(note.authorUid === user?.uid || (member && note.payload.kind === "message")) &&
            button(t("shiftNotes.delete"), () => remove(note), busy)}
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      className="bg-app flex-1"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="gap-2 px-5 py-3">
        {button(t("shiftNotes.back"), () => navigation.goBack(), busy)}
        <Text className="text-content font-heading text-2xl">{t("shiftNotes.title")}</Text>
        <Text className="text-muted">
          {formatDate(parseCalendarDate(context.date))} · {t(`common.${context.shift}`)}
        </Text>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 24 }}>
        {loadError ? (
          <View className="gap-3">
            <Text accessibilityRole="alert" className="text-danger">
              {t("shiftNotes.loadError")}
            </Text>
            {button(t("shiftNotes.retry"), () => setRetry((value) => value + 1))}
          </View>
        ) : notes === null ? (
          <ActivityIndicator accessibilityLabel={t("shiftNotes.loading")} color={colors.accent} />
        ) : (
          <>
            {Object.entries(sectionProblems)
              .filter(([section, count]) => count >= 0 && !sectionConfirmed[section])
              .map(([section]) => (
                <Text key={section} accessibilityLiveRegion="polite" className="text-muted">
                  {t("shiftNotes.awaitingServer", { section: t(`shiftNotes.sections.${section}`) })}
                </Text>
              ))}
            {Object.entries(sectionProblems).some(
              ([section, count]) => section !== "previous" && count === -2,
            ) && (
              <ActivityIndicator
                accessibilityLabel={t("shiftNotes.loading")}
                color={colors.accent}
              />
            )}
            {Object.entries(sectionProblems)
              .filter(([, count]) => count === -1 || count > 0)
              .map(([section, count]) => (
                <View key={section} className="gap-2">
                  <Text accessibilityRole="alert" className="text-warning">
                    {t(count < 0 ? "shiftNotes.sectionUnavailable" : "shiftNotes.unreadableNotes", {
                      section: t(`shiftNotes.sections.${section}`),
                      count,
                    })}
                  </Text>
                  {button(t("shiftNotes.retry"), () => setRetry((value) => value + 1), busy)}
                </View>
              ))}
            {clinical && (
              <View className="bg-primary-soft gap-2 rounded-xl p-4">
                <Text className="text-content font-heading text-lg">
                  {t("shiftNotes.previous")}
                </Text>
                {previous && (
                  <Text className="text-muted">
                    {formatDate(parseCalendarDate(previous.split(":")[0]))} ·{" "}
                    {t(`common.${previous.split(":")[1]}`)}
                  </Text>
                )}
                {sectionProblems.previous === -2 && (
                  <ActivityIndicator
                    accessibilityLabel={t("shiftNotes.loading")}
                    color={colors.accent}
                  />
                )}
                {previousHandovers.map((note) => renderNote(note, true))}
                {sectionConfirmed.previous === true &&
                  sectionProblems.previous === 0 &&
                  previousHandovers.length === 0 && (
                    <Text className="text-muted">{t("shiftNotes.noPrevious")}</Text>
                  )}
              </View>
            )}
            <View>
              <Text className="text-content font-heading text-lg">{t("shiftNotes.current")}</Text>
              {notes.filter((note) => note.shiftKey === current).map((note) => renderNote(note))}
              {currentSectionsEmpty && !notes.some((note) => note.shiftKey === current) && (
                <Text className="text-muted mt-3">{t("shiftNotes.empty")}</Text>
              )}
            </View>
            {assigned.length === 0 ? (
              <Text className="text-muted">{t("shiftNotes.unscheduled")}</Text>
            ) : (
              <View className="gap-4">
                <Text className="text-content font-heading text-lg">
                  {t(editing ? "shiftNotes.editing" : "shiftNotes.add")}
                </Text>
                {!editing && (
                  <View className="flex-row flex-wrap gap-2">
                    {button(
                      t("shiftNotes.message"),
                      () => setDraft({ kind: "message", text: "" }),
                      busy || !key || draft.kind === "message",
                    )}
                    {canHandover &&
                      button(
                        t("shiftNotes.handover"),
                        () => {
                          if (!currentHandoversReady) return;
                          setEditing(ownHandover);
                          setDraft(ownHandover?.payload ?? { ...emptyHandover });
                        },
                        busy || !clinicalKey || !currentHandoversReady || draft.kind === "handover",
                      )}
                  </View>
                )}
                {draft.kind === "handover" ? (
                  <>
                    <Text className="text-muted">{t("shiftNotes.handoverHint")}</Text>
                    {(["medication", "meals", "activities"] as const).map((item) => (
                      <Pressable
                        key={item}
                        accessibilityRole="checkbox"
                        accessibilityLabel={t(`shiftNotes.${item}`)}
                        accessibilityState={{ checked: draft[item], disabled: busy }}
                        disabled={busy}
                        onPress={() => setDraft({ ...draft, [item]: !draft[item] })}
                        className="border-divider min-h-[48px] flex-row items-center gap-3 rounded-xl border px-4 py-3">
                        <Ionicons
                          name={draft[item] ? "checkbox" : "square-outline"}
                          size={24}
                          color={colors.accent}
                        />
                        <Text className="text-content">{t(`shiftNotes.${item}`)}</Text>
                      </Pressable>
                    ))}
                    <Text className="text-content font-subtitle">{t("shiftNotes.pending")}</Text>
                    {draft.pending.map((item, index) => (
                      <View key={item.id} className="gap-2">
                        {field(
                          t("shiftNotes.pendingItem", { count: index + 1 }),
                          item.text,
                          (text) =>
                            setDraft({
                              ...draft,
                              pending: draft.pending.map((current) =>
                                current.id === item.id ? { ...current, text } : current,
                              ),
                            }),
                          300,
                        )}
                        {button(
                          t("shiftNotes.removeItem"),
                          () =>
                            setDraft({
                              ...draft,
                              pending: draft.pending.filter((current) => current.id !== item.id),
                            }),
                          busy,
                        )}
                      </View>
                    ))}
                    {button(
                      t("shiftNotes.addItem"),
                      () =>
                        setDraft({
                          ...draft,
                          pending: [...draft.pending, { id: Crypto.randomUUID(), text: "" }],
                        }),
                      busy || draft.pending.length >= 20,
                    )}
                    {field(
                      t("shiftNotes.observations"),
                      draft.observations,
                      (observations) => setDraft({ ...draft, observations }),
                      2000,
                    )}
                  </>
                ) : (
                  field(
                    t("shiftNotes.messageLabel"),
                    draft.text,
                    (text) => setDraft({ ...draft, text }),
                    1000,
                  )
                )}
                <Text className="text-muted text-xs">
                  {t(
                    draft.kind === "handover"
                      ? "shiftNotes.clinicalPrivacyHint"
                      : "shiftNotes.privacyHint",
                  )}
                </Text>
                {button(
                  t(busy ? "shiftNotes.saving" : "shiftNotes.save"),
                  () => {
                    void save();
                  },
                  busy ||
                    (draft.kind === "handover"
                      ? !canHandover || !clinicalKey || !currentHandoversReady
                      : !key),
                )}
                {editing && button(t("common.cancel"), reset, busy)}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function ShiftNotesScreen() {
  const route = useRoute<RouteProp<MainAppStackParamList, "ShiftNotes">>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const context = shiftContextSchema.safeParse(route.params);
  if (!context.success || !user)
    return <Text accessibilityRole="alert">{t("shiftNotes.loadError")}</Text>;
  return (
    <Notes
      key={`${user.uid}:${context.data.houseId}:${context.data.date}:${context.data.shift}`}
      context={context.data}
    />
  );
}
