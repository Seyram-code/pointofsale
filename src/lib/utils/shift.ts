import { addMoney } from "@/lib/utils/money";

export function calculateExpectedShiftCash(openingFloat: number, netCashSales: number): number {
  return addMoney(openingFloat, netCashSales);
}
