import "server-only";

/**
 * Every value here comes from the environment. Nothing is defaulted to a real
 * credential, and `assertConfigured` fails loudly rather than silently sending
 * empty keys to a provider.
 */

export type PaymentDriver = "mock" | "live";

export function paymentDriver(): PaymentDriver {
  return process.env.PAYMENT_DRIVER === "live" ? "live" : "mock";
}

export interface MomoConfig {
  provider: string;
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  merchantAccount?: string;
  callbackUrl?: string;
  webhookSecret?: string;
}

export function momoConfig(): MomoConfig {
  return {
    provider: process.env.MOMO_PROVIDER ?? "hubtel",
    baseUrl: process.env.MOMO_API_BASE_URL,
    clientId: process.env.MOMO_CLIENT_ID,
    clientSecret: process.env.MOMO_CLIENT_SECRET,
    merchantAccount: process.env.MOMO_MERCHANT_ACCOUNT,
    callbackUrl: process.env.MOMO_CALLBACK_URL,
    webhookSecret: process.env.MOMO_WEBHOOK_SECRET,
  };
}

export interface TerminalConfig {
  provider: string;
  bridgeUrl?: string;
  apiKey?: string;
  timeoutMs: number;
}

export function terminalConfig(): TerminalConfig {
  return {
    provider: process.env.POS_TERMINAL_PROVIDER ?? "generic",
    bridgeUrl: process.env.POS_TERMINAL_BRIDGE_URL,
    apiKey: process.env.POS_TERMINAL_API_KEY,
    timeoutMs: Number(process.env.POS_TERMINAL_TIMEOUT_MS ?? 90_000),
  };
}

export interface CardConfig {
  provider: string;
  baseUrl?: string;
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
}

export function cardConfig(): CardConfig {
  return {
    provider: process.env.CARD_PROVIDER ?? "paystack",
    baseUrl: process.env.CARD_API_BASE_URL,
    publicKey: process.env.CARD_PUBLIC_KEY,
    secretKey: process.env.CARD_SECRET_KEY,
    webhookSecret: process.env.CARD_WEBHOOK_SECRET,
  };
}

/** Returns the names of any required keys that are missing or blank. */
export function missingKeys<T extends object>(config: T, required: Array<keyof T & string>): string[] {
  return required.filter((key) => {
    const value = config[key];
    return value === undefined || value === null || String(value).trim() === "";
  });
}
