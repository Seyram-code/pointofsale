"use client";

import { useEffect } from "react";

const CHECK_INTERVAL_MS = 60_000;
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "click", "scroll", "touchstart", "wheel"] as const;

export function SessionExpiryGuard() {
  useEffect(() => {
    let checking = false;
    let timeoutId: number | undefined;
    let loggingOut = false;
    let lastActivityAt = Date.now();

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

    async function logoutAndRedirect() {
      if (loggingOut) return;
      loggingOut = true;

      void fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          keepalive: true,
        }).catch(() => undefined);

      const next = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/login?next=${encodeURIComponent(next)}&expired=1`);
    }

    function enforceInactivityLimit() {
      if (Date.now() - lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
        void logoutAndRedirect();
        return true;
      }
      return false;
    }

    function resetInactivityTimer() {
      if (timeoutId) window.clearTimeout(timeoutId);
      lastActivityAt = Date.now();
      timeoutId = window.setTimeout(enforceInactivityLimit, INACTIVITY_TIMEOUT_MS);
    }

    const interval = window.setInterval(() => void checkSession(), CHECK_INTERVAL_MS);
    const handleActivity = () => {
      if (!loggingOut) resetInactivityTimer();
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!enforceInactivityLimit()) void checkSession();
    };

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    resetInactivityTimer();

    return () => {
      window.clearInterval(interval);
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
    };
  }, []);

  return null;
}
