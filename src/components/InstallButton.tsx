"use client";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@/lib/client-hooks";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton() {
  const standalone = useMediaQuery("(display-mode: standalone)");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || done) return <p className="text-sm text-ok">Installed - running as an app.</p>;
  if (!deferred) {
    return (
      <p className="text-sm text-fg-muted">
        Open this page in Chrome on the phone and use the browser menu &rarr; &quot;Add to Home screen&quot; if no install
        button appears.
      </p>
    );
  }
  return (
    <button
      type="button"
      className="btn btn-gold w-full"
      onClick={async () => {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") setDone(true);
        setDeferred(null);
      }}
    >
      Install on this phone
    </button>
  );
}
