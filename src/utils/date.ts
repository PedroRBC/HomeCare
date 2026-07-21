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

export function isoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-${pad(week)}`;
}

export function sundayWeek(date: Date) {
  // Get the Sunday of the week (start of week)
  const sunday = new Date(date);
  const dayOfWeek = sunday.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  sunday.setDate(sunday.getDate() - dayOfWeek);

  // Create a unique key for the week starting from Sunday
  // Format: YYYY-MM-DD (Sunday date)
  return `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;
}

export function saturdayWeek(date: Date) {
  // Get the Saturday of the week (start of week)
  const saturday = new Date(date);
  const dayOfWeek = saturday.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // Calculate days to subtract to get to Saturday
  // If dayOfWeek is 0 (Sunday), subtract 1 to get Saturday
  // If dayOfWeek is 1 (Monday), subtract 2 to get Saturday
  // If dayOfWeek is 2 (Tuesday), subtract 3 to get Saturday
  // If dayOfWeek is 3 (Wednesday), subtract 4 to get Saturday
  // If dayOfWeek is 4 (Thursday), subtract 5 to get Saturday
  // If dayOfWeek is 5 (Friday), subtract 6 to get Saturday
  // If dayOfWeek is 6 (Saturday), subtract 0 to get Saturday
  const daysToSubtract = dayOfWeek === 6 ? 0 : dayOfWeek === 0 ? 1 : dayOfWeek + 1;
  saturday.setDate(saturday.getDate() - daysToSubtract);

  // Create a unique key for the week starting from Saturday
  // Format: YYYY-MM-DD (Saturday date)
  return `${saturday.getFullYear()}-${pad(saturday.getMonth() + 1)}-${pad(saturday.getDate())}`;
}
