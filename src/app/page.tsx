import { AppShell } from "@/components/AppShell";
import { LowStockTile } from "@/components/LowStockTile";
import { PlanDueTile } from "@/components/PlanDueTile";
import { QuickLinks } from "@/components/QuickLinks";
import { ScheduleView } from "@/components/ScheduleView";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <AppShell title="Today">
      <ScheduleView />
      <div className="mt-4 space-y-2">
        <PlanDueTile />
        <LowStockTile />
      </div>
      <QuickLinks />
    </AppShell>
  );
}
