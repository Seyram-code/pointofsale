"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MailCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export function ShopActivationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function activate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await api.post("/auth/activate-shop", { email, code });
      setMessage("Your shop is activated. You can now sign in.");
      window.setTimeout(() => router.replace("/login"), 900);
    } catch (activationError) {
      setError(activationError instanceof ApiClientError ? activationError.message : "Could not activate your shop. Try again.");
      setLoading(false);
    }
  }

  async function resend() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await api.post("/auth/resend-shop-activation", { email });
      setMessage("If the shop needs activation, a new code will be sent shortly.");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Could not request a new code.");
    }
    setLoading(false);
  }

  return (
    <Card className="shadow-[var(--shadow-panel)]">
      <CardContent className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"><MailCheck className="size-5" /></span>
          <div><h1 className="text-xl font-semibold text-fg">Activate your shop</h1><p className="text-sm text-fg-muted">Enter the six-digit code sent to your owner email.</p></div>
        </div>
        <form onSubmit={activate} className="space-y-4">
          <Input label="Owner email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input label="Activation code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>}
          {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{message}</p>}
          <Button type="submit" fullWidth loading={loading}>Activate shop</Button>
        </form>
        <Button type="button" variant="secondary" fullWidth className="mt-3" disabled={loading || !email} onClick={resend}>Send a new code</Button>
      </CardContent>
    </Card>
  );
}