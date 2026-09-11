import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { SettingsPanel } from "@/components/SettingsPanel";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  return (
    <AppShell title="Settings">
      <SettingsPanel email={session?.email ?? ""} name={session?.name ?? ""} demo={Boolean(session?.demo)} />
    </AppShell>
  );
}
