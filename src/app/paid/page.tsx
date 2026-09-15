import type { Metadata } from "next";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };

/**
 * Where the customer lands after paying on Square. Public - no sign-in - and
 * deliberately says nothing about the booking beyond the reference.
 */
export default async function PaidPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="font-display text-xl uppercase tracking-wider">
        Detailing <span className="text-gold">Sanctuary</span>
      </div>
      <div className="card-gold w-full p-6">
        <h1 className="font-display text-3xl uppercase text-gold">Thank you</h1>
        <p className="mt-2 text-sm text-fg-dim">
          Your payment has gone through. You will get a confirmation from Square by email.
        </p>
        {ref && <p className="mt-3 text-xs uppercase tracking-wider text-fg-muted">Reference {ref}</p>}
      </div>
      <a href="https://detailingsanctuary.co.uk" className="btn btn-ghost">
        Back to the website
      </a>
    </main>
  );
}
