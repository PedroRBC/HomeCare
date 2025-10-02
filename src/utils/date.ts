export function pad(num: number, size = 2) {
  return String(num).padStart(size, "0");
}

export function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
