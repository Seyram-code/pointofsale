import { CURRENCY_CODE, LOCALE } from "@/lib/config/constants";

type Numeric = number | string | { toString(): string };

function toNumber(value: Numeric): number {
  if (typeof value === "number") return value;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

/** GH₵1,234.50 */
export function formatCurrency(value: Numeric, options?: { compact?: boolean }): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY_CODE,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: options?.compact ? 0 : 2,
    maximumFractionDigits: 2,
    notation: options?.compact ? "compact" : "standard",
  }).format(toNumber(value));
}

export function formatNumber(value: Numeric, fractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(toNumber(value));
}

/** Trims trailing zeros so "2.000 kg" renders as "2 kg". */
export function formatQuantity(value: Numeric): string {
  const n = toNumber(value);
  return Number.isInteger(n) ? formatNumber(n) : formatNumber(n, 3).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatPercent(rate: Numeric, fractionDigits = 1): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(toNumber(rate));
}

export function formatDate(value: Date | string, style: "short" | "long" | "time" | "full" = "short"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const options: Intl.DateTimeFormatOptions =
    style === "time"
      ? { hour: "2-digit", minute: "2-digit" }
      : style === "long"
        ? { day: "numeric", month: "long", year: "numeric" }
        : style === "full"
          ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
          : { day: "2-digit", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "Africa/Accra" }).format(date);
}

/** Normalises 0244123456 / +233244123456 / 233244123456 to 0244123456. */
export function normalizeGhanaPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return digits;
  if (/^233\d{9}$/.test(digits)) return `0${digits.slice(3)}`;
  return null;
}

export function formatGhanaPhone(input: string): string {
  const normalized = normalizeGhanaPhone(input);
  if (!normalized) return input;
  return `${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`;
}
