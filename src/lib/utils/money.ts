/**
 * Money helpers. All arithmetic runs on integer pesewas to avoid the float
 * rounding errors that would otherwise show up on a receipt total.
 */

type Numeric = number | string | { toString(): string };

export function toPesewas(value: Numeric): number {
  const n = typeof value === "number" ? value : Number(value.toString());
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

export function fromPesewas(pesewas: number): number {
  return Math.round(pesewas) / 100;
}

export function money(value: Numeric): number {
  return fromPesewas(toPesewas(value));
}

export function addMoney(...values: Numeric[]): number {
  return fromPesewas(values.reduce<number>((sum, v) => sum + toPesewas(v), 0));
}

export function subtractMoney(a: Numeric, b: Numeric): number {
  return fromPesewas(toPesewas(a) - toPesewas(b));
}

export function multiplyMoney(value: Numeric, factor: Numeric): number {
  const f = typeof factor === "number" ? factor : Number(factor.toString());
  return fromPesewas(toPesewas(value) * (Number.isFinite(f) ? f : 0));
}

export function percentOf(value: Numeric, rate: Numeric): number {
  return multiplyMoney(value, typeof rate === "number" ? rate : Number(rate.toString()));
}

/** Extracts the tax already baked into a VAT-inclusive shelf price. */
export function taxFromInclusive(grossAmount: Numeric, rate: number): number {
  return fromPesewas(toPesewas(grossAmount) * (rate / (1 + rate)));
}

export function taxFromExclusive(netAmount: Numeric, rate: number): number {
  return fromPesewas(toPesewas(netAmount) * rate);
}

/** Rounds a cash total to the nearest 5 pesewas — smallest coin in practical circulation. */
export function roundCashTender(value: Numeric): number {
  return fromPesewas(Math.round(toPesewas(value) / 5) * 5);
}

/** Greedy breakdown of change into Ghana Cedi denominations. */
export function computeChangeBreakdown(
  amount: Numeric,
  denominations: readonly number[],
): Array<{ denomination: number; count: number }> {
  let remaining = toPesewas(amount);
  const result: Array<{ denomination: number; count: number }> = [];
  for (const denomination of [...denominations].sort((a, b) => b - a)) {
    const unit = toPesewas(denomination);
    if (unit <= 0) continue;
    const count = Math.floor(remaining / unit);
    if (count > 0) {
      result.push({ denomination, count });
      remaining -= count * unit;
    }
  }
  return result;
}
