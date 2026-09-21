import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or staff code").max(120),
  password: z.string().min(1, "Enter your password").max(200),
  rememberDevice: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const pinLoginSchema = z.object({
  staffCode: z.string().trim().min(2).max(30),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
