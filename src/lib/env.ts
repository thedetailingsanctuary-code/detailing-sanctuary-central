import "server-only";

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

const isProd = process.env.NODE_ENV === "production";
const vercelUrl = read("VERCEL_PROJECT_PRODUCTION_URL") ?? read("VERCEL_URL");

export const env = {
  isProd,
  appBaseUrl: read("APP_BASE_URL") ?? (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000"),
  sessionSecret: read("SESSION_SECRET"),
  cronSecret: read("CRON_SECRET"),
  ms: {
    tenantId: read("MS_TENANT_ID"),
    clientId: read("MS_CLIENT_ID"),
    clientSecret: read("MS_CLIENT_SECRET"),
    allowedEmail: read("ALLOWED_USER_EMAIL")?.toLowerCase(),
    allowedOid: read("ALLOWED_USER_OID"),
  },
  supabase: {
    url: read("SUPABASE_URL"),
    serviceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
  },
  firebase: {
    serviceAccountJson: read("FIREBASE_SERVICE_ACCOUNT_JSON"),
  },
  weatherProvider: read("WEATHER_PROVIDER") ?? "open-meteo",
  paymentProvider: read("PAYMENT_PROVIDER") ?? "square",
  square: {
    accessToken: read("SQUARE_ACCESS_TOKEN"),
    locationId: read("SQUARE_LOCATION_ID"),
    webhookSignatureKey: read("SQUARE_WEBHOOK_SIGNATURE_KEY"),
    environment: read("SQUARE_ENVIRONMENT") ?? "production",
    /** Optional. With no version Square uses the one set on the application. */
    apiVersion: read("SQUARE_API_VERSION"),
  },
  /** Local preview with sample data. Ignored in production builds. */
  demoMode: !isProd && read("DEMO_MODE") === "true",
};

export const configured = {
  microsoft: Boolean(
    env.ms.tenantId &&
      env.ms.clientId &&
      env.ms.clientSecret &&
      (env.ms.allowedEmail || env.ms.allowedOid) &&
      env.sessionSecret,
  ),
  supabase: Boolean(env.supabase.url && env.supabase.serviceRoleKey),
  push: Boolean(env.firebase.serviceAccountJson),
  cron: Boolean(env.cronSecret),
  payments: Boolean(env.square.accessToken && env.square.locationId),
  /** Webhooks are optional: without one the scheduled check polls Square instead. */
  paymentWebhook: Boolean(env.square.webhookSignatureKey),
};
