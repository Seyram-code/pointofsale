import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { listPosCategories } from "@/lib/services/product.service";
import { isMockDriver } from "@/lib/payments/registry";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payments/types";
import { PosTerminal } from "@/components/pos/PosTerminal";

export const metadata: Metadata = { title: "Make a Sale" };
export const dynamic = "force-dynamic";

const METHODS: PaymentMethod[] = ["CASH", "MOMO", "CARD_TERMINAL", "CARD"];

export default async function PosPage() {
  const { user } = await requirePermission(PERMISSIONS.POS_ACCESS, "/pos");
  const categories = user.storeId ? await listPosCategories(user.storeId) : [];

  return (
    <PosTerminal
      categories={categories}
      paymentMethods={METHODS.map((method) => ({ method, label: PAYMENT_METHOD_LABELS[method] }))}
      mockPaymentDriver={isMockDriver()}
      permissions={{
        canDiscount: user.permissions.includes(PERMISSIONS.POS_DISCOUNT_APPLY),
        canHold: user.permissions.includes(PERMISSIONS.POS_HOLD_SALE),
      }}
    />
  );
}
