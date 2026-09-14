export type Job = {
  id: string;
  /** What the job is, e.g. "Full Valet" or "Stage 1/2 + Ceramic Coating". */
  service: string;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  postcode: string | null;
  coordinates: { lat: number; lng: number } | null;
  /** ISO instants (UTC). */
  start: string;
  end: string;
  isAllDay: boolean;
  webLink: string | null;
  notes: string | null;
  rawSubject: string;
};

export type ScheduleSource = "live" | "cache" | "demo";

export type Schedule = {
  generatedAt: string;
  fetchedAt: string;
  source: ScheduleSource;
  todayKey: string;
  tomorrowKey: string;
  today: Job[];
  tomorrow: Job[];
  current: Job | null;
  next: Job | null;
  needsReauth?: boolean;
  error?: string;
};

export type MonthDay = {
  /** "YYYY-MM-DD" (London). */
  dateKey: string;
  jobs: Job[];
  /** Booked minutes that fall inside this day. */
  minutes: number;
};

export type MonthView = {
  /** "YYYY-MM" (London). */
  monthKey: string;
  generatedAt: string;
  fetchedAt: string;
  source: ScheduleSource;
  days: MonthDay[];
  totals: { jobs: number; bookedDays: number; hours: number };
  needsReauth?: boolean;
  error?: string;
};
