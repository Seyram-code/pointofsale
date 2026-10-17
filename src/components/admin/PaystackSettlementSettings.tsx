"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LoaderCircle, ShieldCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type SettlementState = {
  status: string | null;
  bankCode: string | null;
  bankName: string | null;
  accountName: string | null;
  accountLast4: string | null;
  verifiedAt: string | null;
  paystackEnabled: boolean;
  platformPercentageCharge: number | null;
  configured: boolean;
};

type BankOption = { code: string; name: string };

export function PaystackSettlementSettings({ initialState, canManage }: { initialState: SettlementState; canManage: boolean }) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [bankCode, setBankCode] = useState(initialState.bankCode ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canManage || state.configured || state.status === "PENDING" || state.platformPercentageCharge === null) return;
    let cancelled = false;
    setLoadingBanks(true);
    api.get<BankOption[]>("/settings/payments/settlement/banks")
      .then((options) => {
        if (!cancelled) {
          setBanks(options);
          if (!initialState.bankCode && options[0]) setBankCode(options[0].code);
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof ApiClientError ? loadError.message : "Could not load settlement banks.");
      })
      .finally(() => !cancelled && setLoadingBanks(false));
    return () => { cancelled = true; };
  }, [canManage, initialState.bankCode, state.configured, state.platformPercentageCharge, state.status]);

  async function connectAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bankCode || !accountNumber.trim()) return;
    setSaving(true);
    setError("");
    try {
      const result = await api.post<SettlementState & { bankName: string; accountName: string; accountLast4: string }>(
        "/settings/payments/settlement",
        { bankCode, accountNumber: accountNumber.trim() },
      );
      setAccountNumber("");
      setState({ ...state, ...result, configured: true });
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof ApiClientError ? saveError.message : "Could not connect the settlement account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="size-5 text-brand-600" />Paystack settlement account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.configured ? (
          <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="font-medium text-fg">Settlement account verified</p>
              <p className="mt-1 text-sm text-fg-secondary">{state.accountName} · {state.bankName} · ending {state.accountLast4}</p>
              {state.verifiedAt && <p className="mt-1 text-xs text-fg-muted">Verified {new Date(state.verifiedAt).toLocaleDateString("en-GH")}</p>}
            </div>
          </div>
        ) : state.status === "PENDING" ? (
          <p role="status" className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-fg-secondary">
            Paystack is processing this settlement setup. New submissions are paused to avoid creating duplicate destinations. Contact support if this status does not resolve.
          </p>
        ) : (
          <>
            <p className="max-w-2xl text-sm text-fg-secondary">
              Connect the shop&apos;s bank account to receive its share of Paystack card and Mobile Money sales. Paystack verifies the account details; VidyPOS does not save the full account number.
            </p>
            {state.platformPercentageCharge === null ? (
              <p role="status" className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-fg-secondary">
                Online settlement setup is not available yet. The platform administrator must configure the Paystack settlement percentage first.
              </p>
            ) : (
              <form onSubmit={connectAccount} className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Settlement bank"
                  value={bankCode}
                  onChange={(event) => setBankCode(event.target.value)}
                  options={banks.map((bank) => ({ value: bank.code, label: bank.name }))}
                  disabled={!canManage || loadingBanks || saving || banks.length === 0}
                  required
                />
                <Input
                  label="Bank account number"
                  inputMode="numeric"
                  autoComplete="off"
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))}
                  disabled={!canManage || saving}
                  required
                />
                {error && <p role="alert" className="text-sm text-danger sm:col-span-2">{error}</p>}
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  {canManage && <Button type="submit" loading={saving} disabled={loadingBanks || banks.length === 0 || !bankCode || !accountNumber.trim()}>Connect and verify account</Button>}
                  {loadingBanks && <LoaderCircle className="size-4 animate-spin text-fg-muted" aria-label="Loading banks" />}
                </div>
                {!canManage && <p className="text-xs text-fg-muted sm:col-span-2">You need settings management permission to connect a settlement account.</p>}
              </form>
            )}
            <p className="text-xs text-fg-muted">The platform share is {state.platformPercentageCharge ?? 0}% of each Paystack transaction, covering Paystack processing and VidyPOS fees. The remainder is allocated to this shop.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
