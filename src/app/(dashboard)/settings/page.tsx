import type { Metadata } from "next";
import { AdminList } from "@/components/admin/AdminList";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { StoreDetailsForm } from "@/components/admin/StoreDetailsForm";
import { TaxRateSettings } from "@/components/admin/TaxRateSettings";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user } = await requirePermission(PERMISSIONS.SETTINGS_VIEW, "/settings");
  const settings = user.storeId ? await prisma.setting.findMany({ where: { storeId: user.storeId }, orderBy: { key: "asc" } }) : [];
  const taxRates = user.storeId ? await prisma.taxRate.findMany({ where: { storeId: user.storeId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }) : [];
  const store = user.storeId ? await prisma.store.findUnique({ where: { id: user.storeId }, select: { name: true, addressLine: true, phone: true, city: true, region: true, ghanaPostGps: true, tinNumber: true, vatNumber: true, receiptFooter: true, currency: true, timezone: true } }) : null;
  const canManageSettings = user.permissions.includes(PERMISSIONS.SETTINGS_MANAGE);

  return (
    <div className="space-y-6">
      {store && canManageSettings && <StoreDetailsForm initialValues={store} />}
      {user.storeId && canManageSettings && <TaxRateSettings initialTaxRates={taxRates.map((rate) => ({ id: rate.id, name: rate.name, rate: Number(rate.rate), description: rate.description ?? null, isDefault: rate.isDefault, isActive: rate.isActive }))} />}
      <AdminList title="Settings" description="Review store and application configuration." headers={["Setting", "Value", "Updated"]} rows={settings.map((setting) => [<span key="key" className="font-medium">{setting.key}</span>, <span key="value" className="max-w-md truncate">{JSON.stringify(setting.value)}</span>, <span key="date">{setting.updatedAt.toLocaleDateString("en-GH")}</span>])} emptyTitle="No store settings yet" emptyMessage="Store configuration will appear here when it is set up." />
    </div>
  );
}
