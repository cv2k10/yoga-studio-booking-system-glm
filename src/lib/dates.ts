import { getContext } from "hono/context-storage";
import type { AppEnv } from "@/env";

const DEFAULT_TZ = "Asia/Kuala_Lumpur";

/**
 * The studio's timezone. Workers run in UTC, so "today" and class start
 * instants are computed in this zone rather than the runtime's local time.
 */
export function studioTimeZone(): string {
  try {
    return getContext<AppEnv>().env.STUDIO_TZ || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

/** Wall-clock parts of `instant` in the studio timezone. */
function zonedParts(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: studioTimeZone(),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

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
  const { year, month, day } = zonedParts(new Date());
  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
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

/** The instant a class starts, given its wall-clock date and time at the studio. */
export function sessionDateTimeISO(sessionDate: string, startTime: string): Date {
  const [y, m, d] = sessionDate.split("-").map(Number);
  const [h, mi] = startTime.split(":").map(Number);
  const wallAsUTC = Date.UTC(y, (m ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0);
  // Offset of the studio zone at (roughly) that moment; good enough except
  // within an hour of a DST switch, which the default zone does not have.
  const zoned = zonedParts(new Date(wallAsUTC));
  const zonedAsUTC = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  return new Date(wallAsUTC - (zonedAsUTC - wallAsUTC));
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
    timeZone: studioTimeZone(),
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
