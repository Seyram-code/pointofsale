import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db/prisma";

function escapeHtml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function sendSuperAdminAlert(input: {
  subject: string;
  text: string;
  details: Array<{ label: string; value: string }>;
}) {
  const [admins, host, user, password, from] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null, email: { not: null } },
      select: { email: true },
    }),
    Promise.resolve(process.env.SMTP_HOST),
    Promise.resolve(process.env.SMTP_USER),
    Promise.resolve(process.env.SMTP_PASSWORD),
    Promise.resolve(process.env.MAIL_FROM),
  ]);
  const recipients = [...new Set(admins.map((admin) => admin.email).filter((email): email is string => Boolean(email)))];
  if (recipients.length === 0) return;
  const port = Number(process.env.SMTP_PORT ?? 587);
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

  const detailsText = input.details.map(({ label, value }) => `${label}: ${value}`).join("\n");
  const detailsHtml = input.details
    .map(({ label, value }) => `<tr><th style="padding:8px;text-align:left">${escapeHtml(label)}</th><td style="padding:8px">${escapeHtml(value)}</td></tr>`)
    .join("");
  try {
    await transport.sendMail({
      from,
      to: recipients,
      subject: input.subject,
      text: `${input.text}\n\n${detailsText}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#17201c"><h1 style="font-size:22px">${escapeHtml(input.subject)}</h1><p>${escapeHtml(input.text)}</p><table style="border-collapse:collapse;width:100%">${detailsHtml}</table></div>`,
    });
  } finally {
    transport.close();
  }
}

export async function notifySuperAdmins(input: Parameters<typeof sendSuperAdminAlert>[0]) {
  try {
    await sendSuperAdminAlert(input);
  } catch (error) {
    console.error("[super-admin-alert] email delivery failed", error);
  }
}