import "server-only";

/**
 * Taking money is behind one small interface, the same way the weather is.
 * Square is what the website uses, so it is what the app uses - but moving to
 * Stripe or SumUp later means one new file and one environment variable, with
 * no change to the screens or the database.
 */

export type CreateLinkArgs = {
  /** What the customer sees on the payment page. */
  description: string;
  amountPence: number;
  currency: string;
  /** Our own reference, so a payment can be matched back to the request. */
  reference: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
};

export type CreatedLink = {
  linkId: string;
  url: string;
  orderId: string | null;
};

export type RemoteStatus = "paid" | "unpaid" | "cancelled" | "unknown";

export interface PaymentProvider {
  readonly name: string;
  /** Hosted payment page. Card details never reach this app. */
  createLink(args: CreateLinkArgs): Promise<CreatedLink>;
  /** Used to catch up if a webhook was missed. */
  checkStatus(orderId: string): Promise<{ status: RemoteStatus; paidPence: number | null; paymentId: string | null }>;
  /** Verify a webhook really came from the provider. */
  verifyWebhook(rawBody: string, signature: string | null, notificationUrl: string): boolean;
  /** Pull what matters out of a webhook body. */
  parseWebhook(rawBody: string): { orderId: string | null; paymentId: string | null; status: RemoteStatus; paidPence: number | null } | null;
}
