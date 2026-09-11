import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { configured, env } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  not_allowed: "That Microsoft account is not allowed to use this app.",
  not_configured: "Microsoft sign-in is not configured yet. See docs/SETUP.md.",
  supabase_not_configured: "The database is not configured yet, so sign-in cannot be completed. See docs/SETUP.md.",
  cancelled: "Sign-in was cancelled.",
  state_mismatch: "The sign-in attempt expired. Please try again.",
  missing_code: "Microsoft did not return a sign-in code. Please try again.",
  no_id_token: "Microsoft did not return an identity token. Check the app registration scopes.",
  exchange_failed: "Could not complete sign-in with Microsoft. Check the client secret and redirect URI.",
  microsoft_error: "Microsoft reported an error during sign-in.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? `Sign-in failed (${error}).`) : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <Image src="/icons/icon-192.png" alt="" width={96} height={96} className="rounded-2xl" priority />
      <h1 className="mt-6 text-center font-display text-3xl uppercase tracking-wider">
        Detailing <span className="text-gold">Sanctuary</span>
      </h1>
      <p className="mt-1 font-display text-sm uppercase tracking-[0.3em] text-fg-muted">Central</p>

      <div className="card mt-10 w-full max-w-sm p-5">
        {env.demoMode ? (
          <>
            <p className="text-sm text-fg-dim">Local preview mode is on. No sign-in is needed on this machine.</p>
            <Link href="/" className="btn btn-gold mt-4 w-full">
              Open the app
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-fg-dim">This app is private. Sign in with your Microsoft 365 account to continue.</p>
            <a href="/api/auth/login" className="btn btn-gold mt-4 w-full" aria-disabled={!configured.microsoft}>
              Sign in with Microsoft
            </a>
            {!configured.microsoft && (
              <p className="mt-3 text-xs text-warn">Microsoft sign-in is not configured on this deployment yet.</p>
            )}
          </>
        )}
        {message && <p className="mt-4 rounded-lg border border-danger/50 p-3 text-sm text-danger">{message}</p>}
      </div>
    </main>
  );
}
