import "server-only";
import nodemailer from "nodemailer";
import { getAppUrl } from "@/lib/config/app-url";

function escapeHtml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function createSubscriptionExpiryReminderMailer() {
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
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  const appUrl = getAppUrl();

  return {
    async send(input: {
      email: string;
      businessName: string;
      plan: string;
      daysRemaining: number;
      periodEnd: Date;
      timeZone: string;
    }) {
      const expiryDate = new Intl.DateTimeFormat("en-GH", {
        dateStyle: "long",
        timeZone: input.timeZone,
      }).format(input.periodEnd);
      const dayLabel = `${input.daysRemaining} ${input.daysRemaining === 1 ? "day" : "days"}`;
      const subject = `VidyPOS subscription renewal reminder: ${dayLabel} remaining`;
      const renewalUrl = `${appUrl}/subscription`;
      const businessName = escapeHtml(input.businessName);
      const plan = escapeHtml(input.plan);

      await transport.sendMail({
        from,
        to: input.email,
        subject,
        text: `Hello ${input.businessName},\n\nYour VidyPOS ${input.plan} subscription expires in ${dayLabel}, on ${expiryDate}. Renew your subscription before it expires to avoid interruption to your shop's POS access.\n\nRenew here: ${renewalUrl}\n\nIf you have already renewed, please disregard this reminder.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#17201c"><h1 style="font-size:22px">Subscription renewal reminder</h1><p>Hello ${businessName},</p><p>Your VidyPOS <strong>${plan}</strong> subscription expires in <strong>${dayLabel}</strong>, on ${escapeHtml(expiryDate)}.</p><p>Renew before it expires to avoid interruption to your shop's POS access.</p><p><a href="${escapeHtml(renewalUrl)}" style="display:inline-block;padding:12px 20px;background:#008f4c;color:#fff;text-decoration:none;border-radius:6px;font-weight:700">Renew subscription</a></p><p>If you have already renewed, please disregard this reminder.</p></div>`,
      });
    },
    close() {
      transport.close();
    },
  };
}
