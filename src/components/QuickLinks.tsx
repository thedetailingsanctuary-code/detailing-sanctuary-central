import Link from "next/link";

export const WEBSITE_URL = "https://detailingsanctuary.co.uk";

export function QuickLinks() {
  return (
    <section className="mt-6 grid grid-cols-3 gap-2" aria-label="Quick links">
      <Link href="/pricing" className="card flex min-h-20 flex-col items-center justify-center gap-1 p-3 text-center">
        <span className="font-display text-lg uppercase">Prices</span>
        <span className="text-[0.65rem] uppercase tracking-wider text-fg-muted">Calculator</span>
      </Link>
      <Link href="/gallery" className="card flex min-h-20 flex-col items-center justify-center gap-1 p-3 text-center">
        <span className="font-display text-lg uppercase">Gallery</span>
        <span className="text-[0.65rem] uppercase tracking-wider text-fg-muted">Recent work</span>
      </Link>
      <a
        href={WEBSITE_URL}
        target="_blank"
        rel="noopener"
        className="card flex min-h-20 flex-col items-center justify-center gap-1 border-gold/40 p-3 text-center"
      >
        <span className="font-display text-lg uppercase text-gold">Website</span>
        <span className="text-[0.65rem] uppercase tracking-wider text-fg-muted">Opens in browser</span>
      </a>
    </section>
  );
}
