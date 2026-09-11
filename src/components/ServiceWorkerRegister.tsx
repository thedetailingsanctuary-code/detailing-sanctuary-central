"use client";
import { useEffect } from "react";

/** Registers the offline/push service worker (production builds, or NEXT_PUBLIC_SW_DEV=true). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_DEV === "true";
    if (!enabled) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((e) => console.warn("[sw] registration failed", e));
  }, []);
  return null;
}
