export function pad(num: number, size = 2) {
  return String(num).padStart(size, "0");
}

export function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseCalendarDate(dateValue: string) {
  const [datePart] = dateValue.split("T");
  const [year, month, day] = datePart.split("-").map(Number);

  return new Date(year, month - 1, day, 12);
}

export function monthKey(year: number, monthIndex0: number) {
  return `${year}-${pad(monthIndex0 + 1)}`;
}

// Saturday that starts the (Saturday to Friday) week of `date`, as YYYY-MM-DD
export function saturdayWeek(date: Date) {
  const saturday = new Date(date);
  saturday.setDate(date.getDate() - ((date.getDay() + 1) % 7));
  return dateKey(saturday);
}
