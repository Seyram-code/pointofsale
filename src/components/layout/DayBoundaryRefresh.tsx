"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function DayBoundaryRefresh() {
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setUTCHours(24, 0, 0, 1000);

    const refreshTimer = window.setTimeout(() => router.refresh(), nextMidnight.getTime() - now.getTime());
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = window.setInterval(() => router.refresh(), 30_000);

    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);

    return () => {
      window.clearTimeout(refreshTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [router]);

  return null;
}