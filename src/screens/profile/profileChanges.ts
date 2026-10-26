import type { AvatarConfig } from "@/components/AvatarPicker";

export type ProfileSaveDecision =
  { kind: "nameRequired" } | { kind: "noChanges" } | { kind: "save"; trimmedName: string };

export function decideProfileSave(params: {
  displayName: string;
  storedName: string | null | undefined;
  avatarConfig: AvatarConfig;
  storedAvatarConfig: AvatarConfig;
}): ProfileSaveDecision {
  const trimmedName = params.displayName.trim();
  if (!trimmedName) {
    return { kind: "nameRequired" };
  }

  // A missing stored name is compared as "", so an email-derived pre-fill counts as a change and gets saved
  const nameChanged = trimmedName !== (params.storedName ?? "");
  const avatarChanged =
    JSON.stringify(params.avatarConfig) !== JSON.stringify(params.storedAvatarConfig);

  if (!nameChanged && !avatarChanged) {
    return { kind: "noChanges" };
  }

  return { kind: "save", trimmedName };
}
