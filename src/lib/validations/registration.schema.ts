import { z } from "zod";

export const businessTypeSchema = z.enum([
  "SUPERMARKET",
  "PROVISION_STORE",
  "PHARMACY",
  "RESTAURANT",
  "MINI_MART",
  "WHOLESALE",
  "OTHER",
]);

export const registrationSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name").max(160),
  businessType: businessTypeSchema,
  businessRegistrationNumber: z.string().trim().max(80).optional().or(z.literal("")),
  businessPhone: z.string().trim().min(7, "Enter a valid business phone number").max(40),
  businessEmail: z.string().trim().email("Enter a valid business email address").max(160),
  address: z.string().trim().min(3, "Enter your business address").max(240),
  city: z.string().trim().min(2, "Enter your city").max(80),
  region: z.string().trim().min(2, "Enter your region").max(80),
  country: z.string().trim().min(2, "Enter your country").max(80),
  logoUrl: z.string().trim().url("Enter a valid logo URL").max(255).optional().or(z.literal("")),
  currency: z.string().trim().min(2, "Enter a currency").max(10).default("GHS"),
  taxSettings: z.string().trim().max(600).optional().or(z.literal("")),
  ownerName: z.string().trim().min(2, "Enter the owner's name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(160),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(40),
  password: z.string().min(1, "Create a password").max(200),
  plan: z.enum(["STARTER", "GROWTH", "ENTERPRISE"]),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;