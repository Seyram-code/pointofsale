import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listPosCategories } from "@/lib/services/product.service";
import { prisma } from "@/lib/db/prisma";
import { isMockCardDriver, isMockMomoDriver } from "@/lib/payments/registry";
import { isPaystackMethod } from "@/lib/payments/config";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payments/types";
import { PosTerminal } from "@/components/pos/PosTerminal";
import { isPaystackEnabled } from "@/lib/services/payment-settings.service";

export const metadata: Metadata = { title: "Make a Sale" };
export const dynamic = "force-dynamic";

const METHODS: PaymentMethod[] = ["CASH", "MOMO", "CARD_TERMINAL", "CARD"];

export default async function PosPage() {
  const { user } = await requirePermission(PERMISSIONS.POS_ACCESS, "/pos");
  const [categories, store, paystackEnabled] = await Promise.all([
    user.storeId ? listPosCategories(user.storeId) : Promise.resolve([]),
    user.storeId ? prisma.store.findUnique({ where: { id: user.storeId }, select: { email: true } }) : Promise.resolve(null),
    user.storeId ? isPaystackEnabled(user.storeId) : Promise.resolve(false),
  ]);
  const paymentMethods = METHODS.filter((method) =>
    paystackEnabled || !((method === "CARD" || method === "MOMO") && isPaystackMethod(method)),
  );

  return (
    <PosTerminal
      categories={categories}
      paymentMethods={paymentMethods.map((method) => ({ method, label: PAYMENT_METHOD_LABELS[method] }))}
      mockCardDriver={isMockCardDriver()}
      mockMomoDriver={isMockMomoDriver()}
      storeEmail={store?.email ?? ""}
      permissions={{
        canDiscount: user.permissions.includes(PERMISSIONS.POS_DISCOUNT_APPLY),
        canHold: user.permissions.includes(PERMISSIONS.POS_HOLD_SALE),
      }}
    />
  );
}
