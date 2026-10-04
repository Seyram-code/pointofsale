import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import nodemailer from "nodemailer";

const ACTIVATION_CODE_TTL_MS = 30 * 60 * 1000;
const PRODUCTION_APP_URL = "https://pos.firstdestltd.com";

function usableAppUrl(value: string | undefined, production: boolean): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && !production)) return null;
    const hostname = url.hostname.toLowerCase();
    if (production && (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "0.0.0.0" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    )) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function createStoreActivationCode() {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return {
    code,
    hash: createHash("sha256").update(code).digest("hex"),
    expiresAt: new Date(Date.now() + ACTIVATION_CODE_TTL_MS),
  };
}

export function createStoreActivationLinkToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + ACTIVATION_CODE_TTL_MS),
  };
}

export async function sendStoreActivationEmail(input: {
  email: string;
  businessName: string;
  code: string;
  linkToken: string;
  appUrl?: string;
}) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.MAIL_FROM;

  if (!host || !user || !password || !from || !Number.isInteger(port)) {
    throw new Error("SMTP email configuration is incomplete");
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass: password },
  });
  const production = process.env.NODE_ENV === "production";
  const appUrl = production
    ? usableAppUrl(process.env.NEXT_PUBLIC_APP_URL, true) ?? PRODUCTION_APP_URL
    : usableAppUrl(process.env.NEXT_PUBLIC_APP_URL, false)
      ?? usableAppUrl(input.appUrl, false)
      ?? "http://localhost:3000";
  const activationUrl = `${appUrl}/activate?email=${encodeURIComponent(input.email)}&token=${encodeURIComponent(input.linkToken)}`;
  const safeBusinessName = input.businessName.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);

  await transport.sendMail({
    from,
    to: input.email,
    subject: `Activate ${input.businessName} on VidyPOS`,
    text: `Activate ${input.businessName} by opening this one-time link and clicking Activate shop: ${activationUrl}\n\nOr enter this six-digit fallback code on the activation page: ${input.code}. Both expire in 30 minutes.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#17201c"><h1 style="font-size:22px">Activate ${safeBusinessName}</h1><p>Click below to open the secure activation page. You will confirm activation there.</p><p><a href="${activationUrl}" style="display:inline-block;padding:12px 20px;background:#008f4c;color:#fff;text-decoration:none;border-radius:6px;font-weight:700">Continue to activate shop</a></p><p>This one-time link expires in 30 minutes. If the link does not work, enter this six-digit code on the activation page:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px">${input.code}</p></div>`,
  });
}