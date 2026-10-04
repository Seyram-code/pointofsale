import "server-only";
import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";

export function createPasswordResetToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  };
}

export async function sendPasswordResetEmail(input: { email: string; fullName: string; token: string; appUrl: string }) {
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
  const resetUrl = `${input.appUrl}/reset-password?token=${encodeURIComponent(input.token)}`;
  const safeName = input.fullName.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);

  await transport.sendMail({
    from,
    to: input.email,
    subject: "Reset your VidyPOS password",
    text: `Hello ${input.fullName},\n\nUse this secure link to reset your VidyPOS password: ${resetUrl}\n\nThis link expires in 30 minutes and can only be used once. If you did not request a reset, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#17201c"><h1 style="font-size:22px">Reset your password</h1><p>Hello ${safeName},</p><p>Use the button below to choose a new password for your VidyPOS account.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#008f4c;color:#fff;text-decoration:none;border-radius:6px;font-weight:700">Reset password</a></p><p>This one-time link expires in 30 minutes. If you did not request a password reset, you can ignore this email.</p></div>`,
  });
}