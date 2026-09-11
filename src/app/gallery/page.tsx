import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { GalleryGrid } from "@/components/GalleryGrid";

export const metadata: Metadata = { title: "Gallery" };
export const dynamic = "force-dynamic";

export default function GalleryPage() {
  return (
    <AppShell title="Gallery">
      <GalleryGrid />
    </AppShell>
  );
}
