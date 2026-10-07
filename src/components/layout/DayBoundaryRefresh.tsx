"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function DayBoundaryRefresh({
  expectedUserId,
  expectedStoreId,
}: {
  expectedUserId?: string;
  expectedStoreId?: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    let checking = false;
    let lastDashboardDate = new Date().toISOString().slice(0, 10);

    async function refreshIfAuthenticated() {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
        if (response.status === 401) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        if (response.ok) {
          const payload = await response.json();
          const currentUser = payload?.data as { id?: string; storeId?: string | null } | undefined;
          if (
            expectedUserId &&
            (currentUser?.id !== expectedUserId || currentUser?.storeId !== expectedStoreId)
          ) {
            window.location.replace(window.location.href);
            return;
          }

          const dashboardDate = new Date().toISOString().slice(0, 10);
          if (dashboardDate !== lastDashboardDate) {
            lastDashboardDate = dashboardDate;
            router.refresh();
          }
        }
      } catch {
      } finally {
        checking = false;
      }
    }

    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setUTCHours(24, 0, 0, 1000);

    const refreshTimer = window.setTimeout(() => void refreshIfAuthenticated(), nextMidnight.getTime() - now.getTime());
    const refreshOnReturn = () => {
      void refreshIfAuthenticated();
    };
    const interval = window.setInterval(() => void refreshIfAuthenticated(), 30_000);

    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    window.addEventListener("pageshow", refreshOnReturn);

    return () => {
      window.clearTimeout(refreshTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
      window.removeEventListener("pageshow", refreshOnReturn);
    };
  }, [expectedStoreId, expectedUserId, router]);

  return null;
}