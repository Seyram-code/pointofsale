"use client";

import { useState } from "react";
import { Eye, PauseCircle, PlayCircle, Settings2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { RenewSubscriptionButton } from "@/components/platform/RenewSubscriptionButton";

const PLANS = ["STARTER", "GROWTH", "ENTERPRISE"] as const;
type Plan = (typeof PLANS)[number];
type PaymentMethod = "CARD" | "MOMO";
type Action = "activate" | "suspend" | "cancel" | "change_plan";

export interface PlatformBusinessActionStore {
  id: string;
  name: string;
  businessId: string | null;
  branchCode: string;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  region: string | null;
  currency: string;
  isActive: boolean;
  staffCount: number;
  branches: number;
  plan: string | null;
  status: string | null;
  subscriptionStart: Date | null;
  currentPeriodEnd: Date | null;
  monthlyPrice: number;
  createdAt: Date;
}

export function PlatformBusinessActions({ store }: { store: PlatformBusinessActionStore }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [viewOpen, setViewOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>((store.plan as Plan) ?? "STARTER");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");
  const [loading, setLoading] = useState<Action | null>(null);
  const [confirmation, setConfirmation] = useState<Action | null>(null);

  async function runAction(action: Action, plan?: Plan) {
    setLoading(action);
    try {
      const response = await fetch(`/api/platform/businesses/${store.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(plan ? { plan, paymentMethod: plan === "ENTERPRISE" ? undefined : paymentMethod, paymentPhone: plan === "ENTERPRISE" ? undefined : store.phone } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "Business action failed");

      success("Business updated", `${store.name} was ${action.replace("_", " ")} successfully.`);
      setPlanOpen(false);
      router.refresh();
    } catch (actionError) {
      error("Business update failed", actionError instanceof Error ? actionError.message : "Please try again.");
    } finally {
      setLoading(null);
    }
  }

  function requestAction(action: Action) {
    if (action === "change_plan") {
      void runAction(action, selectedPlan);
      return;
    }
    setConfirmation(action);
  }

  return (
    <>
      <div className="flex min-w-[360px] flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" leftIcon={<Eye className="size-3.5" />} onClick={() => setViewOpen(true)}>
          View
        </Button>
        {store.isActive ? (
          <Button type="button" size="sm" variant="outline" loading={loading === "suspend"} leftIcon={<PauseCircle className="size-3.5" />} onClick={() => requestAction("suspend")}>
            Suspend
          </Button>
        ) : (
          <Button type="button" size="sm" variant="success" loading={loading === "activate"} leftIcon={<PlayCircle className="size-3.5" />} onClick={() => requestAction("activate")}>
            Activate
          </Button>
        )}
        <Button type="button" size="sm" variant="danger" loading={loading === "cancel"} leftIcon={<XCircle className="size-3.5" />} onClick={() => requestAction("cancel")}>
          Cancel
        </Button>
        <Button type="button" size="sm" variant="outline" leftIcon={<Settings2 className="size-3.5" />} onClick={() => setPlanOpen(true)}>
          Change plan
        </Button>
        <RenewSubscriptionButton storeId={store.id} businessName={store.name} />
      </div>

      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title={store.name} description="Registered business details" size="lg">
        <dl className="grid gap-4 sm:grid-cols-2">
          {[
            ["Business ID", store.businessId ?? "—"],
            ["Branch", store.branchCode],
            ["Status", store.isActive ? "Active" : "Suspended"],
            ["Subscription", store.status ?? "—"],
            ["Plan", store.plan ?? "—"],
            ["Subscription date", store.subscriptionStart?.toLocaleDateString("en-GB") ?? "—"],
            ["Next subscription", store.currentPeriodEnd?.toLocaleDateString("en-GB") ?? "—"],
            ["Monthly price", `GHS ${store.monthlyPrice.toLocaleString("en-GH")}`],
            ["Location", [store.addressLine, store.city, store.region].filter(Boolean).join(", ") || "—"],
            ["Phone", store.phone ?? "—"],
            ["Email", store.email ?? "—"],
            ["Users / branches", `${store.staffCount} / ${store.branches}`],
            ["Currency", store.currency],
            ["Registered", store.createdAt.toLocaleDateString("en-GB")],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-muted/30 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{label}</dt>
              <dd className="mt-1 text-sm font-medium text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      </Modal>

      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title={`Change plan for ${store.name}`}
        description="Select the subscription plan to apply."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setPlanOpen(false)} disabled={loading === "change_plan"}>Cancel</Button>
            <Button type="button" loading={loading === "change_plan"} onClick={() => requestAction("change_plan")}>Save plan</Button>
          </>
        }
      >
        <label className="grid gap-2 text-sm font-medium text-fg" htmlFor={`plan-${store.id}`}>
          Subscription plan
          <select id={`plan-${store.id}`} value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value as Plan)} className="h-11 rounded-lg border border-line-strong bg-card px-3 text-sm text-fg">
            {PLANS.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
          </select>
        </label>
        {selectedPlan !== "ENTERPRISE" && (
          <label className="mt-4 grid gap-2 text-sm font-medium text-fg" htmlFor={`payment-${store.id}`}>
            Payment method
            <select id={`payment-${store.id}`} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className="h-11 rounded-lg border border-line-strong bg-card px-3 text-sm text-fg">
              <option value="CARD">Card payment</option>
              <option value="MOMO">Mobile Money{store.phone ? ` (${store.phone})` : ""}</option>
            </select>
            <span className="text-xs font-normal text-fg-muted">The plan changes only after the payment provider confirms the charge.</span>
          </label>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmation !== null}
        title={`${confirmation ? confirmation[0].toUpperCase() + confirmation.slice(1) : "Confirm"} business action?`}
        message={`${confirmation ? confirmation[0].toUpperCase() + confirmation.slice(1) : "Update"} ${store.name}?`}
        confirmLabel={confirmation ? confirmation[0].toUpperCase() + confirmation.slice(1) : "Confirm"}
        destructive={confirmation === "cancel" || confirmation === "suspend"}
        loading={confirmation !== null && loading === confirmation}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => { if (confirmation) void runAction(confirmation); setConfirmation(null); }}
      />
    </>
  );
}
