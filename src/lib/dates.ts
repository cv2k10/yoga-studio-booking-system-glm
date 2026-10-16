export const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Monday-based day index: 1..7 */
export function mondayIndex(dowJs: number): number {
  return dowJs === 0 ? 7 : dowJs;
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Monday of the week containing `iso`. */
export function startOfWeekISO(iso: string): string {
  const date = parseISODate(iso);
  const shift = mondayIndex(date.getDay()) - 1;
  date.setDate(date.getDate() - shift);
  return toISODate(date);
}

export function currentWeekStart(): string {
  return startOfWeekISO(todayISO());
}

export function isValidISODate(value: string | undefined | null): boolean {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatDateLong(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatDateNumeric(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${`${m ?? 0}`.padStart(2, "0")} ${suffix}`;
}

export function formatRange(time: string, durationMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  const endH = Math.floor((total % 1440) / 60);
  const endM = total % 60;
  return `${formatTime(time)} – ${formatTime(`${`${endH}`.padStart(2, "0")}:${`${endM}`.padStart(2, "0")}`)}`;
}

export function sessionDateTimeISO(sessionDate: string, startTime: string): Date {
  const [y, m, d] = sessionDate.split("-").map(Number);
  const [h, mi] = startTime.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, 0, 0);
}

export function isPast(sessionDate: string, startTime: string): boolean {
  return sessionDateTimeISO(sessionDate, startTime).getTime() < Date.now();
}

export function hoursUntil(sessionDate: string, startTime: string): number {
  return (sessionDateTimeISO(sessionDate, startTime).getTime() - Date.now()) / 3_600_000;
}

export function formatMoney(cents: number): string {
  return `RM${(cents / 100).toFixed(2)}`;
}

export function formatDateTime(value: Date | string | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
