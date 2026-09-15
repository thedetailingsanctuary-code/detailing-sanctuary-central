import Link from "next/link";

export const WEBSITE_URL = "https://detailingsanctuary.co.uk";
export const INSTAGRAM_URL = "https://www.instagram.com/thedetailingsanctuary";

export function QuickLinks() {
  return (
    <section className="mt-6 grid grid-cols-3 gap-2" aria-label="Quick links">
      <Link href="/plans" className="card flex min-h-20 flex-col items-center justify-center gap-1 p-3 text-center">
        <span className="font-display text-base uppercase">Plans</span>
        <span className="text-[0.6rem] uppercase tracking-wider text-fg-muted">Who is due</span>
      </Link>
      <Link href="/payments" className="card flex min-h-20 flex-col items-center justify-center gap-1 p-3 text-center">
        <span className="font-display text-base uppercase">Payments</span>
        <span className="text-[0.6rem] uppercase tracking-wider text-fg-muted">Get paid</span>
      </Link>
      <Link href="/spend" className="card flex min-h-20 flex-col items-center justify-center gap-1 p-3 text-center">
        <span className="font-display text-base uppercase">Spend</span>
        <span className="text-[0.6rem] uppercase tracking-wider text-fg-muted">Product costs</span>
      </Link>
      <a
        href={WEBSITE_URL}
        target="_blank"
        rel="noopener"
        className="card flex min-h-20 flex-col items-center justify-center gap-1 border-gold/40 p-3 text-center"
      >
        <span className="font-display text-base uppercase text-gold">Website</span>
        <span className="text-[0.6rem] uppercase tracking-wider text-fg-muted">Opens in browser</span>
      </a>
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener"
        className="card flex min-h-20 flex-col items-center justify-center gap-1 border-gold/40 p-3 text-center"
      >
        <span className="font-display text-base uppercase text-gold">Instagram</span>
        <span className="text-[0.6rem] uppercase tracking-wider text-fg-muted">Your feed</span>
      </a>
      <Link href="/stock" className="card flex min-h-20 flex-col items-center justify-center gap-1 p-3 text-center">
        <span className="font-display text-base uppercase">Stock</span>
        <span className="text-[0.6rem] uppercase tracking-wider text-fg-muted">What is left</span>
      </Link>
    </section>
  );
}
