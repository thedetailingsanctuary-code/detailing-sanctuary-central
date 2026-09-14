import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { MonthCalendar } from "@/components/MonthCalendar";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <AppShell title="Calendar">
      <MonthCalendar />
    </AppShell>
  );
}
