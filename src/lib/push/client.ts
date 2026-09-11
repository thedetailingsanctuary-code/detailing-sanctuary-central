"use client";
import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

/** Browser-side helpers. Firebase web config is public by design; the VAPID key is the public half. */
export function firebaseWebConfig(): FirebaseOptions | null {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_CONFIG_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FirebaseOptions;
  } catch {
    return null;
  }
}

export function pushConfiguredOnClient(): boolean {
  return Boolean(firebaseWebConfig() && process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);
}

export type EnablePushResult = { ok: true; token: string } | { ok: false; reason: string };

export async function enablePush(): Promise<EnablePushResult> {
  if (typeof window === "undefined") return { ok: false, reason: "Not in a browser" };
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { ok: false, reason: "This browser does not support notifications" };
  }
  const cfg = firebaseWebConfig();
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!cfg || !vapidKey) return { ok: false, reason: "Push is not configured yet (Firebase keys missing)" };
  if (!(await isSupported())) return { ok: false, reason: "Firebase messaging is not supported in this browser" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Notification permission was not granted" };

  const registration = await navigator.serviceWorker.ready;
  const app = getApps()[0] ?? initializeApp(cfg);
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return { ok: false, reason: "Could not get a device token" };

  const res = await fetch("/api/push/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, userAgent: navigator.userAgent }),
  });
  if (!res.ok) return { ok: false, reason: "Could not save the device token" };
  try {
    localStorage.setItem("dsc_push_token", token);
  } catch {
    /* ignore */
  }
  return { ok: true, token };
}
