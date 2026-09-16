import { addDays } from "@/lib/time";
import type { HubJob } from "./types";

/** Sample jobs for local preview only (no real customer data). */
export function demoJobs(today: string): HubJob[] {
  const mk = (
    j: Partial<HubJob> &
      Pick<HubJob, "reference" | "customerName" | "startsAt" | "totalPence" | "depositPence" | "balancePence">,
  ): HubJob => ({
    bookingId: "demo-booking",
    secondBookingId: null,
    secondStartsAt: null,
    customerEmail: null,
    customerPhone: "+447700900001",
    address: null,
    town: "Wolverhampton",
    postcode: "WV6 8AB",
    vehicle: "Black BMW 3 Series",
    sizeLabel: "Large",
    lines: [],
    atCustomer: false,
    notes: null,
    status: "booked",
    pulledAt: `${today}T07:00:00.000Z`,
    ...j,
  });

  return [
    mk({
      reference: "DS-MU2ZVVPM",
      customerName: "Sample Customer A",
      startsAt: `${addDays(today, 1)}T09:00:00.000Z`,
      // The hub sends this one as 509 / 127 / 382 in pounds. Kept the same here
      // so a conversion that ever goes wrong shows up as £5.09 on the screen
      // instead of looking like a plausible price.
      totalPence: 50900,
      depositPence: 12700,
      balancePence: 38200,
      lines: [
        { name: "Stage 1 Machine Polish", pricePence: 39900 },
        { name: "Ceramic Coating", pricePence: 11000 },
      ],
    }),
    mk({
      reference: "DS-K7Q4XBNR",
      customerName: "Sample Customer B",
      startsAt: `${today}T08:30:00.000Z`,
      totalPence: 18500,
      depositPence: 4600,
      // Finished today, so the balance is owed but nothing has been sent yet.
      balancePence: 13900,
      status: "done",
      vehicle: "Silver VW Golf",
      sizeLabel: "Medium",
      atCustomer: true,
      lines: [{ name: "Full Valet", pricePence: 18500 }],
      notes: "Park on the drive, side gate is unlocked.",
    }),
    mk({
      reference: "DS-3PVT9WZC",
      customerName: "Sample Customer C",
      startsAt: `${addDays(today, -3)}T13:00:00.000Z`,
      totalPence: 12000,
      depositPence: 3000,
      // Balance sent and still waiting - the state the chase is written for.
      balancePence: 9000,
      status: "invoiced",
      vehicle: "Red Ford Fiesta",
      sizeLabel: "Small",
      lines: [{ name: "Deep Clean Service", pricePence: 12000 }],
    }),
    mk({
      reference: "DS-8LWD5HKF",
      customerName: "Sample Customer D",
      startsAt: `${addDays(today, -9)}T10:00:00.000Z`,
      totalPence: 26000,
      depositPence: 6500,
      // Settled, so it drops out of the outstanding figure entirely.
      balancePence: 19500,
      status: "paid",
      vehicle: "White Audi A4",
      lines: [{ name: "Interior Deep Clean", pricePence: 26000 }],
    }),
  ];
}
