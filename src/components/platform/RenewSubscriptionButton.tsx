"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

export function RenewSubscriptionButton({ storeId, businessName }: { storeId: string; businessName: string }) {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);

  async function renew() {
    if (!window.confirm(`Renew the subscription for ${businessName} for one month?`)) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/platform/businesses/${storeId}/subscription/renew`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "Subscription renewal failed");

      success("Subscription renewed", `${businessName} is active through ${new Date(payload.data.currentPeriodEnd).toLocaleDateString("en-GB")}.`);
      router.refresh();
    } catch (renewalError) {
      error("Renewal failed", renewalError instanceof Error ? renewalError.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="success"
      loading={loading}
      leftIcon={<RefreshCw className="size-3.5" />}
      onClick={renew}
      aria-label={`Renew subscription for ${businessName}`}
    >
      Renew subscription
    </Button>
  );
}
