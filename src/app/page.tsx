import { AppShell } from "@/components/AppShell";
import { LowStockTile } from "@/components/LowStockTile";
import { QuickLinks } from "@/components/QuickLinks";
import { ScheduleView } from "@/components/ScheduleView";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <AppShell title="Today">
      <ScheduleView />
      <div className="mt-4">
        <LowStockTile />
      </div>
      <QuickLinks />
    </AppShell>
  );
}
