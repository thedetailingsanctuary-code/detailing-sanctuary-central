/** Time helpers pinned to UK time. Safe to use on server and client. */
export const LONDON_TZ = "Europe/London";

export type LondonParts = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
};

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

let cachedFormatter: Intl.DateTimeFormat | null = null;
function formatter() {
  cachedFormatter ??= new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  return cachedFormatter;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function londonParts(d: Date): LondonParts {
  const p: Record<string, string> = {};
  for (const part of formatter().formatToParts(d)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAYS[p.weekday] ?? 0,
  };
}

/** Offset of London local time from UTC at the given instant, in ms. */
export function londonOffsetMs(d: Date): number {
  const p = londonParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** "YYYY-MM-DD" for the London calendar day containing the instant. */
export function londonDateKey(d: Date): string {
  const p = londonParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The instant at which the given London calendar day starts. */
export function londonMidnight(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const off1 = londonOffsetMs(guess);
  let inst = new Date(guess.getTime() - off1);
  const off2 = londonOffsetMs(inst);
  if (off2 !== off1) inst = new Date(guess.getTime() - off2);
  return inst;
}

export function addDays(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function londonMinutesOfDay(d: Date): number {
  const p = londonParts(d);
  return p.hour * 60 + p.minute;
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: LONDON_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDayLabel(dateKey: string): string {
  const d = londonMidnight(dateKey);
  return d.toLocaleDateString("en-GB", {
    timeZone: LONDON_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatShortDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: LONDON_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function minutesUntil(iso: string | Date, now: Date = new Date()): number {
  return Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
}

export function sameLondonDay(a: string | Date, b: string | Date): boolean {
  return londonDateKey(new Date(a)) === londonDateKey(new Date(b));
}
