"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface PlanPrice { key: string; name: string; monthlyPrice: number | null; priceLabel: string }

export function PlatformPlanManager() {
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [plans, setPlans] = useState<PlanPrice[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadPlans = useCallback(async () => {
    if (loaded) return;
    const response = await fetch("/api/platform/plans");
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "Could not load plan prices");
    setPlans(payload.data);
    setValues(Object.fromEntries(payload.data.map((plan: PlanPrice) => [plan.key, plan.monthlyPrice === null ? "" : String(plan.monthlyPrice)])));
    setLoaded(true);
  }, [loaded]);

  async function savePlan(plan: PlanPrice) {
    const raw = values[plan.key] ?? "";
    const monthlyPrice = raw.trim() === "" ? null : Number(raw);
    if (monthlyPrice !== null && (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0)) {
      error("Invalid amount", "Enter a positive monthly amount.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/platform/plans", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: plan.key, monthlyPrice }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "Could not update plan amount");
      setPlans(payload.data);
      success("Plan amount updated", `${plan.name} now uses ${payload.data.find((item: PlanPrice) => item.key === plan.key)?.priceLabel}.`);
    } catch (saveError) {
      error("Plan update failed", saveError instanceof Error ? saveError.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function openManager() {
    try { await loadPlans(); setOpen(true); } catch (loadError) { error("Could not load plans", loadError instanceof Error ? loadError.message : "Please try again."); }
  }

  useEffect(() => { if (!open) return; void loadPlans(); }, [loadPlans, open]);

  return (
    <>
      <Button type="button" variant="outline" leftIcon={<CreditCard className="size-4" />} onClick={openManager}>Manage subscription plans</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Manage subscription plans" description="Update the monthly amounts shown to businesses and on the public plans page." size="lg">
        <div className="space-y-4">
          {plans.map((plan) => <div key={plan.key} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[1fr_220px_auto] sm:items-end"><div><p className="font-semibold text-fg">{plan.name}</p><p className="text-xs text-fg-muted">{plan.key === "ENTERPRISE" ? "Leave blank for custom pricing." : "Amount in Ghana cedis per month."}</p></div><Input label="Monthly amount (GHS)" type="number" min="1" step="0.01" value={values[plan.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [plan.key]: event.target.value }))} placeholder={plan.key === "ENTERPRISE" ? "Custom" : "Amount"} /><Button type="button" size="sm" loading={loading} onClick={() => savePlan(plan)}>Save amount</Button></div>)}
        </div>
      </Modal>
    </>
  );
}
