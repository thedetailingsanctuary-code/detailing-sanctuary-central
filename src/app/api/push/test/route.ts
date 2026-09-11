import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { sendPushToAll } from "@/lib/push";
import { formatTime } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Sends a harmless test notification to every registered device. */
export async function POST() {
  try {
    await requireSession();
    const result = await sendPushToAll({
      title: "DS Central test",
      body: `Push notifications are working (${formatTime(new Date())}).`,
      url: "/settings",
      tag: "test",
    });
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e);
  }
}
