import "server-only";
import { graphFetch } from "@/lib/calendar/graph";

export type OutgoingMail = {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
};

/** Sends from the signed-in Microsoft 365 mailbox and keeps a copy in Sent Items. Needs the Mail.Send permission. */
export async function sendMail(mail: OutgoingMail): Promise<void> {
  await graphFetch<void>("/me/sendMail", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: mail.subject,
        body: { contentType: "HTML", content: mail.html },
        toRecipients: [{ emailAddress: { address: mail.to, name: mail.toName ?? undefined } }],
      },
      saveToSentItems: true,
    }),
  });
}
