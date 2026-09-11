import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "@/lib/env";
import type { PushMessage, PushProvider } from "./types";

let app: App | null = null;

function firebaseApp(): App {
  if (app) return app;
  const raw = env.firebase.serviceAccountJson;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const sa = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
  app =
    getApps()[0] ??
    initializeApp({
      credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
    });
  return app;
}

/** Firebase Cloud Messaging (web push transport). */
export class FcmProvider implements PushProvider {
  readonly name = "fcm";

  async send(tokens: string[], message: PushMessage): Promise<{ sent: number; invalidTokens: string[] }> {
    if (tokens.length === 0) return { sent: 0, invalidTokens: [] };
    const url = message.url ?? "/";
    const absolute = url.startsWith("http") ? url : `${env.appBaseUrl}${url}`;
    const res = await getMessaging(firebaseApp()).sendEachForMulticast({
      tokens,
      data: { title: message.title, body: message.body, url, tag: message.tag ?? "dsc" },
      webpush: {
        headers: { Urgency: "high", TTL: "1800" },
        ...(absolute.startsWith("https://") ? { fcmOptions: { link: absolute } } : {}),
      },
    });
    const invalidTokens: string[] = [];
    res.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error?.code ?? "";
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-argument") ||
        code.includes("invalid-registration-token")
      ) {
        invalidTokens.push(tokens[i]);
      } else {
        console.warn("[fcm] send failed", code, r.error?.message);
      }
    });
    return { sent: res.successCount, invalidTokens };
  }
}
