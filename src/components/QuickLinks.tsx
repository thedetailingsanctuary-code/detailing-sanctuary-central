import Link from "next/link";

export const WEBSITE_URL = "https://detailingsanctuary.co.uk";
export const INSTAGRAM_URL = "https://www.instagram.com/thedetailingsanctuary";

export function QuickLinks() {
  return (
    <section className="mt-6 grid grid-cols-2 gap-2" aria-label="Quick links">
      <Link href="/plans" className="card flex min-h-20 flex-col items-center justify-center gap-1 p-3 text-center">
        <span className="font-display text-lg uppercase">Plans</span>
        <span className="text-[0.65rem] uppercase tracking-wider text-fg-muted">Who is due</span>
      </Link>
      <Link href="/spend" className="card flex min-h-20 flex-col items-center justify-center gap-1 p-3 text-center">
        <span className="font-display text-lg uppercase">Spend</span>
        <span className="text-[0.65rem] uppercase tracking-wider text-fg-muted">Product costs</span>
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
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener"
        className="card flex min-h-20 flex-col items-center justify-center gap-1 border-gold/40 p-3 text-center"
      >
        <span className="font-display text-lg uppercase text-gold">Instagram</span>
        <span className="text-[0.65rem] uppercase tracking-wider text-fg-muted">@thedetailingsanctuary</span>
      </a>
    </section>
  );
}
