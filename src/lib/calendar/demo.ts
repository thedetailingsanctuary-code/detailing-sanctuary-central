import { addDays, londonDateKey, londonMidnight, monthDayKeys } from "@/lib/time";
import type { Job } from "./types";

/** Sample jobs for local preview only (no real customer data). */
export function demoJobs(now: Date): Job[] {
  const todayKey = londonDateKey(now);
  const day0 = londonMidnight(todayKey).getTime();
  const day1 = londonMidnight(addDays(todayKey, 1)).getTime();
  const at = (base: number, h: number, m = 0) => new Date(base + (h * 60 + m) * 60000).toISOString();

  const mk = (partial: Partial<Job> & Pick<Job, "id" | "service" | "start" | "end">): Job => ({
    customerName: null,
    phone: null,
    email: null,
    address: null,
    postcode: null,
    coordinates: null,
    isAllDay: false,
    webLink: null,
    notes: null,
    rawSubject: partial.service,
    ...partial,
  });

  return [
    mk({
      id: "demo-1",
      service: "Full Valet",
      customerName: "Sample Customer",
      phone: "+447700900001",
      address: "12 Sample Road, Codsall, Wolverhampton WV8 1PX, UK",
      postcode: "WV8 1PX",
      start: at(day0, 8, 30),
      end: at(day0, 11, 30),
      notes: "Black SUV on the drive. Gate code 1234.",
    }),
    mk({
      id: "demo-2",
      service: "Stage 1/2 + Ceramic Coating",
      customerName: "Another Customer",
      phone: "+447700900002",
      address: "Dudley DY1 1HL, UK",
      postcode: "DY1 1HL",
      start: at(day0, 12, 30),
      end: at(day0, 17, 30),
    }),
    mk({
      id: "demo-3",
      service: "Maintenance Wash",
      customerName: "Plan Customer",
      address: "Tettenhall, Wolverhampton WV6 8AB, UK",
      postcode: "WV6 8AB",
      start: at(day1, 9, 0),
      end: at(day1, 10, 30),
    }),
    mk({
      id: "demo-4",
      service: "Deep Clean Service",
      customerName: "City Customer",
      address: "Birmingham B1 1BB, UK",
      postcode: "B1 1BB",
      start: at(day1, 11, 30),
      end: at(day1, 15, 45),
    }),
  ];
}

/** Sample month for local preview only (no real customer data). */
export function demoMonthJobs(monthKey: string): Job[] {
  const services = [
    { name: "Full Valet", hours: 3 },
    { name: "Maintenance Wash", hours: 1.5 },
    { name: "Deep Clean Service", hours: 5 },
    { name: "Stage 1/2 + Ceramic Coating", hours: 7 },
    { name: "Car Sale Prep", hours: 4 },
  ];
  const places = ["Codsall WV8 1PX", "Dudley DY1 1HL", "Tettenhall WV6 8AB", "Birmingham B1 1BB"];
  const out: Job[] = [];

  for (const dateKey of monthDayKeys(monthKey)) {
    const day = Number(dateKey.slice(-2));
    if (day % 7 === 0) continue; // a day off
    const base = londonMidnight(dateKey).getTime();
    const count = day % 5 === 0 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const svc = services[(day + i) % services.length];
      const startHour = i === 0 ? 8.5 : 13.5;
      out.push({
        id: `demo-${dateKey}-${i}`,
        service: svc.name,
        customerName: `Sample Customer ${day}${i ? "b" : ""}`,
        phone: "+447700900001",
        email: null,
        address: `${places[(day + i) % places.length]}, UK`,
        postcode: places[(day + i) % places.length].split(" ").slice(-2).join(" "),
        coordinates: null,
        start: new Date(base + startHour * 3600000).toISOString(),
        end: new Date(base + (startHour + svc.hours) * 3600000).toISOString(),
        isAllDay: false,
        webLink: null,
        notes: null,
        rawSubject: svc.name,
      });
    }
  }
  return out;
}
