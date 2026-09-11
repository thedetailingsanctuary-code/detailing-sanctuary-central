import Image from "next/image";
import Link from "next/link";
import { BottomNav } from "./BottomNav";

export function AppShell({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-top sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="Home">
            <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="rounded-md" priority />
            <span className="font-display text-lg uppercase tracking-wider">
              Detailing <span className="text-gold">Sanctuary</span>
            </span>
          </Link>
          <span className="ml-auto font-display text-sm uppercase tracking-[0.2em] text-fg-muted">{title}</span>
          {action}
        </div>
      </header>
      <main className="safe-bottom mx-auto w-full max-w-lg flex-1 px-4 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
