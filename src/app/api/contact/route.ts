import { NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { z } from "zod";
import { ApiError, created, handleApiError } from "@/lib/api/response";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(30).optional().default(""),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(200).optional().default(""),
});

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const requestsByIp = new Map<string, { count: number; expiresAt: number }>();

function allowRequest(ip: string) {
  const now = Date.now();
  const current = requestsByIp.get(ip);
  if (!current || current.expiresAt <= now) {
    requestsByIp.set(ip, { count: 1, expiresAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (current.count >= RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const input = contactSchema.parse(await request.json());
    if (input.website) return created({ sent: true });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "unknown";
    if (!allowRequest(ip)) throw new ApiError("RATE_LIMITED", "Too many messages. Please try again later.", 429);

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const username = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD;
    const from = process.env.MAIL_FROM;
    if (!host || !username || !password || !from || !Number.isInteger(port)) {
      throw new Error("SMTP email configuration is incomplete");
    }

    const transport = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: username, pass: password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    const safeName = input.name.replace(/[<>&"']/g, "");
    const safeMessage = input.message.replace(/[<>&"']/g, "");
    try {
      await transport.sendMail({
        from,
        to: "hello@vidyposgh.com",
        replyTo: input.email,
        subject: `Website contact from ${safeName}`,
        text: `Name: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone || "Not provided"}\n\nMessage:\n${input.message}`,
        html: `<h2>Website contact message</h2><p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${input.email}</p><p><strong>Phone:</strong> ${input.phone || "Not provided"}</p><p><strong>Message:</strong></p><p>${safeMessage.replaceAll("\n", "<br>")}</p>`,
      });
    } catch (error) {
      const mailError = error instanceof Error ? error.message : "Unknown SMTP error";
      console.error("[contact] SMTP delivery failed", mailError);
      throw new ApiError("INTERNAL_ERROR", "We couldn’t send your message right now. Please try again or email hello@vidyposgh.com.", 503);
    } finally {
      transport.close();
    }

    return created({ sent: true });
  } catch (error) {
    return handleApiError(error);
  }
}