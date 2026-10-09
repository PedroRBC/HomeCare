export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

type StoredInvitation = {
  status: InvitationStatus;
  expiresAt: string;
  // Server-checked expiry. Invitations from before it existed have none, and
  // security rules never let them be accepted: they must be sent again.
  expiresAtTs?: unknown;
};

/** Status as the invitee can act on it: unusable pending invitations count as expired. */
export function effectiveInvitationStatus(
  invitation: StoredInvitation,
  now = Date.now(),
): InvitationStatus {
  if (invitation.status !== "pending") return invitation.status;
  const expired = invitation.expiresAtTs == null || new Date(invitation.expiresAt).getTime() < now;
  return expired ? "expired" : "pending";
}
