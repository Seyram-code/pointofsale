import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export interface PasswordStrength {
  valid: boolean;
  issues: string[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const issues: string[] = [];
  if (password.length < 6) issues.push("Must be at least 6 characters");
  if (!/[a-z]/.test(password)) issues.push("Must include a lowercase letter");
  if (!/[A-Z]/.test(password)) issues.push("Must include an uppercase letter");
  if (!/\d/.test(password)) issues.push("Must include a number");
  return { valid: issues.length === 0, issues };
}
