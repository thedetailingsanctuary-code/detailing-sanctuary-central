import { AppShell } from "@/components/AppShell";
import { QuickLinks } from "@/components/QuickLinks";
import { ScheduleView } from "@/components/ScheduleView";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <AppShell title="Today">
      <ScheduleView />
      <QuickLinks />
    </AppShell>
  );
}
