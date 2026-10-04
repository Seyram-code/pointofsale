"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, MailCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { RegionSelect } from "@/components/ui/RegionSelect";
import { SELECTABLE_PLAN_KEYS, SUBSCRIPTION_PLANS } from "@/lib/config/subscription-plans";

// Prices and names come from the shared plan config so registration can never
// drift from the landing page or billing.
const PLANS = SELECTABLE_PLAN_KEYS.map((key) => ({
  value: key,
  name: SUBSCRIPTION_PLANS[key].name,
  description: SUBSCRIPTION_PLANS[key].description,
  price: SUBSCRIPTION_PLANS[key].price,
}));

const BUSINESS_TYPES = [
  { value: "SUPERMARKET", label: "Supermarket" },
  { value: "PROVISION_STORE", label: "Provision Store" },
  { value: "PHARMACY", label: "Pharmacy" },
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "MINI_MART", label: "Mini Mart" },
  { value: "WHOLESALE", label: "Wholesale" },
  { value: "OTHER", label: "Other" },
];

export function RegisterForm({ platformMode = false }: { platformMode?: boolean }) {
  const [plan, setPlan] = useState<(typeof PLANS)[number]["value"]>("STARTER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      await api.post(platformMode ? "/platform/businesses/register" : "/auth/register", {
        businessName: form.get("businessName"),
        businessType: form.get("businessType"),
        businessRegistrationNumber: form.get("businessRegistrationNumber") ?? "",
        businessPhone: form.get("businessPhone"),
        businessEmail: form.get("businessEmail"),
        address: form.get("address"),
        city: form.get("city"),
        region: form.get("region"),
        country: form.get("country"),
        logoUrl: form.get("logoUrl") ?? "",
        currency: form.get("currency") ?? "GHS",
        taxSettings: form.get("taxSettings") ?? "",
        ownerName: form.get("ownerName"),
        email: form.get("email"),
        phone: form.get("phone"),
        password: form.get("password"),
        plan,
      });
      if (platformMode) {
        window.location.reload();
      } else {
        window.location.assign(`/activate?email=${encodeURIComponent(String(form.get("email")))}`);
      }
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError && submissionError.code === "CONFLICT") {
        const message = submissionError.message?.toLowerCase() ?? "";
        if (message.includes("email")) {
          setError("An account with this email already exists. Sign in or use a different email address.");
        } else {
          setError(submissionError.message);
        }
      } else {
        setError(submissionError instanceof Error ? submissionError.message : "Could not create your account. Please try again.");
      }
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input label="Business name" name="businessName" required placeholder="e.g. Adom Supermarket" />
          <div>
            <label className="mb-1 block text-sm font-medium text-fg">Business type</label>
            <select name="businessType" defaultValue="SUPERMARKET" className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand-600">
              {BUSINESS_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <Input label="Business registration number" name="businessRegistrationNumber" placeholder="Optional" />
          <Input label="Business phone" name="businessPhone" required placeholder="+233 24 000 0000" />
          <Input label="Business email" name="businessEmail" type="email" required placeholder="hello@company.com" />
          <Input label="Business address" name="address" required placeholder="Street or plot" containerClassName="sm:col-span-2" />
          <Input label="City" name="city" required placeholder="Accra" />
          <RegionSelect label="Region" name="region" required />
          <Input label="Country" name="country" required defaultValue="Ghana" placeholder="Ghana" />
          <Input label="Logo URL" name="logoUrl" placeholder="https://example.com/logo.png" />
          <Input label="Currency" name="currency" required defaultValue="GHS" />
          <Input label="Tax settings" name="taxSettings" placeholder="VAT 15%" containerClassName="sm:col-span-2" />

          <Input label="Owner full name" name="ownerName" required placeholder="Owner or manager" />
          <Input label="Owner email" name="email" type="email" required />
          <Input label="Owner phone" name="phone" required placeholder="Owner phone" />
          <Input label="Password" name="password" type="password" required hint="Use uppercase, lowercase, a number and a symbol" containerClassName="sm:col-span-2" />
        </CardContent>
      </Card>
      <div><p className="mb-2 text-sm font-medium text-fg-secondary">Choose your plan</p><div className="grid gap-2">
        {PLANS.map((option) => <button key={option.value} type="button" onClick={() => setPlan(option.value)} className={`flex items-center justify-between rounded-lg border p-3 text-left ${plan === option.value ? "border-brand-600 bg-brand-50 dark:bg-brand-950/30" : "border-line bg-card"}`}><span><span className="block text-sm font-medium text-fg">{option.name}</span><span className="block text-xs text-fg-muted">{option.description}</span></span><span className="flex items-center gap-2 text-xs font-semibold text-fg-secondary">{option.price}{plan === option.value && <Check className="size-4 text-brand-600" />}</span></button>)}
      </div></div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>}
      {!platformMode && (
        <div className="flex items-start gap-3 rounded-lg border border-brand-300 bg-brand-50 px-4 py-3 text-brand-950 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-100">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Email confirmation required</p>
            <p className="mt-0.5 text-sm leading-5">We’ll send a confirmation code to the owner email above. You’ll need it to activate your shop.</p>
          </div>
        </div>
      )}
      <Button type="submit" fullWidth loading={saving} rightIcon={<ArrowRight className="size-4" />}>{platformMode ? "Register business" : "Start 14-day free trial"}</Button>
      {!platformMode && <p className="text-center text-sm text-fg-muted">Already have an account? <Link href="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link></p>}
    </form>
  );
}