import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { JobsPanel } from "@/components/JobsPanel";

export const metadata: Metadata = { title: "Jobs" };
export const dynamic = "force-dynamic";

export default function JobsPage() {
  return (
    <AppShell title="Jobs">
      <JobsPanel />
    </AppShell>
  );
}
