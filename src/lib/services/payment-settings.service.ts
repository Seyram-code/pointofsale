import "server-only";
import { prisma } from "@/lib/db/prisma";

const PAYSTACK_SETTING_KEY = "payments.paystack.enabled";

export async function isPaystackEnabled(storeId: string) {
  const setting = await prisma.setting.findUnique({
    where: { storeId_key: { storeId, key: PAYSTACK_SETTING_KEY } },
    select: { value: true },
  });
  return setting ? setting.value === true : true;
}

export async function setPaystackEnabled(storeId: string, enabled: boolean) {
  await prisma.setting.upsert({
    where: { storeId_key: { storeId, key: PAYSTACK_SETTING_KEY } },
    create: { storeId, key: PAYSTACK_SETTING_KEY, value: enabled },
    update: { value: enabled },
  });
  return enabled;
}