import { fromPesewas, toPesewas } from "@/lib/utils/money";

export const PAYSTACK_FEE_RATE = 0.02;
export const VIDYPOS_PLATFORM_FEE_RATE = 0.01;

export function calculatePaystackFee(amount: number): number {
  const itemTotal = toPesewas(amount);
  const netToShop = (paymentTotal: number) =>
    paymentTotal
      - Math.round(paymentTotal * PAYSTACK_FEE_RATE)
      - Math.round(paymentTotal * VIDYPOS_PLATFORM_FEE_RATE);

  let paymentTotal = Math.ceil(itemTotal / (1 - PAYSTACK_FEE_RATE - VIDYPOS_PLATFORM_FEE_RATE));
  while (netToShop(paymentTotal) < itemTotal) paymentTotal += 1;
  while (paymentTotal > itemTotal && netToShop(paymentTotal - 1) >= itemTotal) paymentTotal -= 1;

  return fromPesewas(paymentTotal - itemTotal);
}
