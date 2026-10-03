import { z } from "zod";

/**
 * Fail fast at boot if a required secret is missing, so the app never starts
 * with a placeholder credential.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  AUTH_COOKIE_NAME: z.string().default("mypos_session"),

  MOMO_PROVIDER: z.string().default("hubtel"),
  MOMO_API_BASE_URL: z.string().optional(),
  MOMO_CLIENT_ID: z.string().optional(),
  MOMO_CLIENT_SECRET: z.string().optional(),
  MOMO_MERCHANT_ACCOUNT: z.string().optional(),
  MOMO_CALLBACK_URL: z.string().optional(),
  MOMO_WEBHOOK_SECRET: z.string().optional(),

  POS_TERMINAL_PROVIDER: z.string().default("generic"),
  POS_TERMINAL_BRIDGE_URL: z.string().optional(),
  POS_TERMINAL_API_KEY: z.string().optional(),
  POS_TERMINAL_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

let cached: z.infer<typeof serverSchema> | null = null;

export function serverEnv() {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  cached = parsed.data;
  return cached;
}

/** Values safe to expose to the browser. */
export const publicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "VidyPOS",
  businessName: process.env.NEXT_PUBLIC_BUSINESS_NAME ?? "VidyPOS Supermarket",
  businessTagline: process.env.NEXT_PUBLIC_BUSINESS_TAGLINE ?? "Point of Sale",
  supportContact: process.env.NEXT_PUBLIC_SUPPORT_CONTACT ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  currency: process.env.NEXT_PUBLIC_CURRENCY ?? "GHS",
  currencySymbol: process.env.NEXT_PUBLIC_CURRENCY_SYMBOL ?? "GH\u20B5",
  locale: process.env.NEXT_PUBLIC_LOCALE ?? "en-GH",
} as const;
