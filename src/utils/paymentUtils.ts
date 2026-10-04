import { dateKey } from "@/utils/date";
import { periodRange, type PaymentFrequency } from "@/utils/paymentDomain";

// A payment is pending (due or overdue) from the last day of its period on.
export const isPaymentPending = (
  payment: { date: Date; frequency: PaymentFrequency },
  today = new Date(),
) => dateKey(today) >= dateKey(periodRange(payment.date, payment.frequency).end);

export const calculatePendingPayments = <T extends { date: Date; frequency: PaymentFrequency }>(
  payments: T[],
) => payments.filter((payment) => isPaymentPending(payment));
