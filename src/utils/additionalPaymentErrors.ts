export type AdditionalPaymentError =
  | "additionalInvalidAmount"
  | "additionalAlreadyPaid"
  | "legacyExtraAlreadyPaid"
  | "additionalRegularRequired"
  | "additionalCaregiverUnavailable"
  | "additionalPending"
  | "additionalScheduleChanged";

export function getAdditionalPaymentError(error: unknown): AdditionalPaymentError | undefined {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (message.includes("Additional amount must be")) return "additionalInvalidAmount";
  if (message.includes("This additional payment was already paid")) return "additionalAlreadyPaid";
  if (message.includes("This legacy extra payment was already paid"))
    return "legacyExtraAlreadyPaid";
  if (message.includes("Some shifts were already paid")) return "additionalScheduleChanged";
  if (message.includes("regular shift is required")) return "additionalRegularRequired";
  if (message.includes("disabled or has no additional amount configured"))
    return "additionalCaregiverUnavailable";
  if (message.includes("pending additional shifts")) return "additionalPending";
  if (
    message.includes("Schedule or rates changed") ||
    message.includes("Schedule changed while clearing")
  )
    return "additionalScheduleChanged";
  return undefined;
}
