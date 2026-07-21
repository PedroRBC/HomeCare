// Payment utility functions for determining payment status

// Check if a payment is due today (last day of the period)
export const isPaymentDueToday = (
  today: Date,
  periodStart: Date,
  frequency: "Semanal" | "Quinzenal" | "Mensal" | "Diário",
): boolean => {
  if (frequency === "Diário") {
    return (
      today.getFullYear() === periodStart.getFullYear() &&
      today.getMonth() === periodStart.getMonth() &&
      today.getDate() === periodStart.getDate()
    );
  }

  if (frequency === "Semanal") {
    // For weekly, check if today is Friday (last day of Saturday-Friday week)
    const todayIsFriday = today.getDay() === 5;
    if (!todayIsFriday) return false;

    // Check if this payment belongs to the current week
    // Saturday is 6 days before Friday
    const saturday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);

    return (
      periodStart.getFullYear() === saturday.getFullYear() &&
      periodStart.getMonth() === saturday.getMonth() &&
      periodStart.getDate() === saturday.getDate()
    );
  } else if (frequency === "Quinzenal") {
    // For quinzenal, check if today is 15th or last day of month
    // and if the period started this quinzena
    const dayOfMonth = today.getDate();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const isLastDayOfQuinzena = dayOfMonth === 15 || dayOfMonth === lastDayOfMonth;

    if (!isLastDayOfQuinzena) return false;

    // Check if this payment belongs to the current quinzena
    const periodDayOfMonth = periodStart.getDate();
    const periodYear = periodStart.getFullYear();
    const periodMonth = periodStart.getMonth();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();

    if (periodYear !== todayYear || periodMonth !== todayMonth) return false;

    if (dayOfMonth === 15) {
      // First quinzena
      return periodDayOfMonth === 1;
    } else {
      // Second quinzena
      return periodDayOfMonth === 16;
    }
  } else {
    // Mensal - check if today is last day of month
    // and if the period started this month
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const isLastDayOfMonth = today.getDate() === lastDayOfMonth;

    if (!isLastDayOfMonth) return false;

    // Check if this payment belongs to the current month
    return (
      periodStart.getFullYear() === today.getFullYear() &&
      periodStart.getMonth() === today.getMonth() &&
      periodStart.getDate() === 1
    );
  }
};

// Check if a payment is overdue (past the due date)
export const isPaymentOverdue = (
  today: Date,
  periodStart: Date,
  frequency: "Semanal" | "Quinzenal" | "Mensal" | "Diário",
): boolean => {
  if (frequency === "Diário") {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const periodStartDate = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth(),
      periodStart.getDate(),
    );
    return todayStart.getTime() > periodStartDate.getTime();
  }

  if (frequency === "Semanal") {
    // For weekly, check if today is past the Friday of the week (Saturday-Friday)
    const friday = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth(),
      periodStart.getDate() + 6,
    );
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return todayStart > friday;
  } else if (frequency === "Quinzenal") {
    // For quinzenal, check if today is past the end of the quinzena
    const dayOfMonth = periodStart.getDate();
    const year = periodStart.getFullYear();
    const month = periodStart.getMonth();

    let periodEnd: Date;
    if (dayOfMonth === 1) {
      // First quinzena ends on 15th
      periodEnd = new Date(year, month, 15);
    } else {
      // Second quinzena ends on last day of month
      periodEnd = new Date(year, month + 1, 0);
    }
    return today > periodEnd;
  } else {
    // Mensal - check if today is past the end of the month
    const monthEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
    return today > monthEnd;
  }
};

// Calculate pending payments (only payments that are due today or overdue)
export const calculatePendingPayments = (upcomingPayments: any[]) => {
  const today = new Date();
  const pending: any[] = [];

  upcomingPayments.forEach((payment) => {
    // Check if this payment period is due today or overdue
    const isDueToday = isPaymentDueToday(today, payment.date, payment.frequency);
    const isOverdue = isPaymentOverdue(today, payment.date, payment.frequency);

    // Show pending if it's due today or overdue
    if (isDueToday || isOverdue) {
      pending.push(payment);
    }
  });

  return pending;
};
