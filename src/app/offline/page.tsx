import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-3xl uppercase tracking-wider">
        No <span className="text-gold">signal</span>
      </h1>
      <p className="mt-3 max-w-xs text-sm text-fg-dim">
        This page is not available offline yet. The Today screen keeps your last schedule, so head back there.
      </p>
      <Link href="/" className="btn btn-gold mt-6">
        Back to Today
      </Link>
    </main>
  );
}
