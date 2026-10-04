"use client";

import { useEffect, useState } from "react";
import { Check, CheckCircle2, CreditCard, LockKeyhole, LoaderCircle, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import type { PlatformPlanPricing } from "@/lib/services/plan-pricing.service";

export function SubscriptionManager({ currentPlan, plans, paymentPhone: initialPaymentPhone, paymentEmail: initialPaymentEmail }: { currentPlan: string; plans: PlatformPlanPricing[]; paymentPhone: string; paymentEmail: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState(currentPlan);
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "MOMO">("CARD");
  const [paymentPhone, setPaymentPhone] = useState(initialPaymentPhone);
  const [paymentEmail, setPaymentEmail] = useState(initialPaymentEmail);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [paymentState, setPaymentState] = useState<"processing" | "success" | "failure" | null>(null);
  const selectedPlan = plans.find((option) => option.key === plan);
  const requiresPayment = selectedPlan?.monthlyPrice !== null;

  const searchParams = useSearchParams();

  useEffect(() => {
    const reference = searchParams.get("reference") ?? searchParams.get("trxref");
    const callbackPlan = searchParams.get("plan");
    const callbackMethod = searchParams.get("method");
    if (!reference || !callbackPlan || (callbackMethod !== "CARD" && callbackMethod !== "MOMO")) return;

    let cancelled = false;
    setSaving(true);
    setPaymentState("processing");
    api.post("/subscription", { plan: callbackPlan, paymentMethod: callbackMethod, reference })
      .then(() => {
        if (cancelled) return;
        setPaymentState("success");
        setMessage("Payment confirmed and your subscription was updated.");
        router.replace("/subscription");
        router.refresh();
      })
      .catch((callbackError) => {
        if (cancelled) return;
        setPaymentState("failure");
        setError(callbackError instanceof ApiClientError ? callbackError.message : "Could not verify your payment");
      })
      .finally(() => {
        if (!cancelled) setSaving(false);
      });

    return () => { cancelled = true; };
  }, [router, searchParams]);

  async function changePlan() {
    setSaving(true);
    setPaymentState("processing");
    setMessage("");
    setError("");
    try {
      if (requiresPayment && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paymentEmail.trim())) {
        throw new Error("Enter a valid customer email for Paystack checkout");
      }
      const paymentResult = await api.post<{ checkoutUrl?: string; plan?: string }>("/subscription", {
        plan,
        ...(requiresPayment ? { paymentMethod, paymentPhone, paymentEmail: paymentEmail.trim() } : {}),
      });
      if (paymentResult.checkoutUrl) {
        window.location.assign(paymentResult.checkoutUrl);
        return;
      }
      setMessage("Plan and monthly amount updated successfully.");
      setPaymentState("success");
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      setSaving(false);
      router.refresh();
    } catch (submissionError) {
      const failureMessage = submissionError instanceof ApiClientError || submissionError instanceof Error ? submissionError.message : "Could not update your plan";
      setError(failureMessage);
      setPaymentState("failure");
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      setSaving(false);
    }
  }

  return <>
    <div className="space-y-3">{plans.map((option) => <button key={option.key} type="button" onClick={() => setPlan(option.key)} className={`flex w-full items-center justify-between rounded-lg border p-3 text-left ${plan === option.key ? "border-brand-600 bg-brand-50 dark:bg-brand-950/30" : "border-line bg-card"}`}><span><span className="block text-sm font-medium text-fg">{option.name}</span><span className="block text-xs text-fg-muted">{option.priceLabel}</span></span>{plan === option.key && <Check className="size-4 text-brand-600" />}</button>)}{requiresPayment && <><label className="grid gap-1 text-sm font-medium text-fg" htmlFor="subscription-payment-method">Payment method<select id="subscription-payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "CARD" | "MOMO")} className="h-11 rounded-lg border border-line-strong bg-card px-3 text-sm text-fg"><option value="CARD">Card payment</option><option value="MOMO">Mobile Money</option></select></label><label className="grid gap-1 text-sm font-medium text-fg" htmlFor="subscription-payment-email">Customer email<input id="subscription-payment-email" type="email" autoComplete="email" required value={paymentEmail} onChange={(event) => setPaymentEmail(event.target.value)} placeholder="name@example.com" className="h-11 rounded-lg border border-line-strong bg-card px-3 text-sm text-fg" /></label>{paymentMethod === "MOMO" && <label className="grid gap-1 text-sm font-medium text-fg" htmlFor="subscription-payment-phone">Mobile Money number<input id="subscription-payment-phone" value={paymentPhone} onChange={(event) => setPaymentPhone(event.target.value)} placeholder="024 000 0000" className="h-11 rounded-lg border border-line-strong bg-card px-3 text-sm text-fg" /></label>}<p className="text-xs text-fg-muted">Your plan changes after the payment provider confirms the charge.</p></>}<Button fullWidth loading={saving} onClick={changePlan}>{saving ? "Processing payment" : requiresPayment ? "Pay and update plan" : "Update plan"}</Button>{message && <p role="status" className="text-sm text-success">{message}</p>}{error && <p role="alert" className="text-sm text-danger">{error}</p>}</div>
    {saving && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="payment-processing-title" aria-describedby="payment-processing-description">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/20 bg-card shadow-2xl">
        <div className={`relative overflow-hidden px-6 pb-7 pt-8 text-white ${paymentState === "success" ? "bg-success" : paymentState === "failure" ? "bg-danger" : "bg-brand-700"}`}>
          <div className="absolute -right-12 -top-16 size-40 rounded-full border-[18px] border-white/10" aria-hidden="true" />
          <div className="relative flex size-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">{paymentState === "success" ? <CheckCircle2 className="size-8" aria-hidden="true" /> : paymentState === "failure" ? <XCircle className="size-8" aria-hidden="true" /> : <LoaderCircle className="size-7 animate-spin" aria-hidden="true" />}</div>
          <p className="relative mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Secure checkout</p>
          <h2 id="payment-processing-title" className="relative mt-1 text-2xl font-semibold">{paymentState === "success" ? "Payment successful" : paymentState === "failure" ? "Payment failed" : "Processing your payment"}</h2>
          <p id="payment-processing-description" className="relative mt-2 text-sm leading-6 text-white/75">{paymentState === "success" ? "Your subscription has been updated successfully." : paymentState === "failure" ? error : "We are confirming your payment before changing your subscription."}</p>
        </div>
        <div className="space-y-5 px-6 py-6">
          <div className="flex items-center justify-between rounded-xl border border-line bg-muted/50 p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">New plan</p><p className="mt-1 font-semibold text-fg">{selectedPlan?.name}</p></div><p className="text-right text-sm font-semibold text-fg">{selectedPlan?.priceLabel}</p></div>
          <div className="space-y-3 text-sm"><div className={`flex items-center gap-3 ${paymentState === "failure" ? "text-danger" : "text-fg"}`}><span className={`flex size-7 items-center justify-center rounded-full ${paymentState === "failure" ? "bg-danger/10" : "bg-brand-100 text-brand-700"}`}>{paymentState === "failure" ? <XCircle className="size-4" aria-hidden="true" /> : <CreditCard className="size-4" aria-hidden="true" />}</span><span>{paymentState === "success" ? "Payment confirmed" : paymentState === "failure" ? "Payment was not completed" : `Connecting to ${paymentMethod === "MOMO" ? "Mobile Money" : "your card provider"}`}</span></div><div className="ml-3.5 h-4 border-l border-dashed border-line-strong" /><div className={`flex items-center gap-3 ${paymentState === "success" ? "text-success" : "text-fg-muted"}`}><span className={`flex size-7 items-center justify-center rounded-full ${paymentState === "success" ? "bg-success/10" : "bg-muted text-fg-muted"}`}>{paymentState === "success" ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <LockKeyhole className="size-4" aria-hidden="true" />}</span><span>{paymentState === "success" ? "Subscription updated securely" : "Updating your subscription securely"}</span></div></div>
          <p className="text-center text-xs leading-5 text-fg-muted">{paymentState === "processing" ? "Please keep this page open while we finish." : "This message will close automatically in a few seconds."}</p>
        </div>
      </div>
    </div>}
  </>;
}