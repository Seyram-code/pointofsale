"use client";

import { useEffect } from "react";

const CHECK_INTERVAL_MS = 60_000;

export function SessionExpiryGuard() {
  useEffect(() => {
    let checking = false;

    async function checkSession() {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (response.status === 401) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?next=${encodeURIComponent(next)}`);
        }
      } catch {
      } finally {
        checking = false;
      }
    }

    const interval = window.setInterval(() => void checkSession(), CHECK_INTERVAL_MS);
    window.addEventListener("focus", checkSession);
    document.addEventListener("visibilitychange", checkSession);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkSession);
      document.removeEventListener("visibilitychange", checkSession);
    };
  }, []);

  return null;
}
