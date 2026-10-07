"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/Button";

const CHECK_INTERVAL_MS = 60_000;
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const WARNING_DURATION_MS = 30 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "click", "scroll", "touchstart", "wheel"] as const;

export function SessionExpiryGuard({
  expectedUserId,
  expectedStoreId,
}: {
  expectedUserId: string;
  expectedStoreId: string | null;
}) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [checkingStay, setCheckingStay] = useState(false);
  const stayLoggedInRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let checking = false;
    let warningTimeoutId: number | undefined;
    let logoutTimeoutId: number | undefined;
    let countdownIntervalId: number | undefined;
    let loggingOut = false;
    let warningVisible = false;
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
          return;
        }
        if (response.ok) {
          const payload = await response.json();
          const currentUser = payload?.data as { id?: string; storeId?: string | null } | undefined;
          if (currentUser?.id !== expectedUserId || currentUser?.storeId !== expectedStoreId) {
            window.location.replace(window.location.href);
          }
        }
      } catch {
      } finally {
        checking = false;
      }
    }

    async function stayLoggedIn() {
      if (checking || loggingOut) return;
      setCheckingStay(true);
      let sessionIsValid = false;
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (response.status === 401) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        sessionIsValid = response.ok;
      } catch {
      } finally {
        setCheckingStay(false);
      }
      if (sessionIsValid) resetInactivityTimer();
    }
    stayLoggedInRef.current = () => void stayLoggedIn();

    async function logoutAndRedirect() {
      if (loggingOut) return;
      loggingOut = true;
      setSecondsRemaining(null);

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

    function clearInactivityTimers() {
      if (warningTimeoutId) window.clearTimeout(warningTimeoutId);
      if (logoutTimeoutId) window.clearTimeout(logoutTimeoutId);
      if (countdownIntervalId) window.clearInterval(countdownIntervalId);
    }

    function showWarning() {
      warningVisible = true;
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((lastActivityAt + INACTIVITY_TIMEOUT_MS - Date.now()) / 1000));
        setSecondsRemaining(remaining);
      };
      updateCountdown();
      countdownIntervalId = window.setInterval(updateCountdown, 250);
    }

    function resetInactivityTimer() {
      clearInactivityTimers();
      warningVisible = false;
      setSecondsRemaining(null);
      lastActivityAt = Date.now();
      warningTimeoutId = window.setTimeout(showWarning, INACTIVITY_TIMEOUT_MS - WARNING_DURATION_MS);
      logoutTimeoutId = window.setTimeout(enforceInactivityLimit, INACTIVITY_TIMEOUT_MS);
    }

    const interval = window.setInterval(() => void checkSession(), CHECK_INTERVAL_MS);
    const handleActivity = () => {
      if (!loggingOut && !warningVisible) resetInactivityTimer();
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
      clearInactivityTimers();
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
    };
  }, [expectedStoreId, expectedUserId]);

  if (secondsRemaining === null) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px]" role="presentation">
      <section
        aria-labelledby="session-expiry-title"
        aria-describedby="session-expiry-description"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-panel)]"
        role="alertdialog"
      >
        <div className="flex size-11 items-center justify-center rounded-full bg-warning/15 text-warning-700 dark:text-warning">
          <Clock3 aria-hidden="true" className="size-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-fg" id="session-expiry-title">Still there?</h2>
        <p className="mt-2 text-sm text-fg-secondary" id="session-expiry-description">
          You will be signed out due to inactivity in {secondsRemaining} {secondsRemaining === 1 ? "second" : "seconds"}.
        </p>
        <Button className="mt-6 w-full" disabled={checkingStay} onClick={() => stayLoggedInRef.current()}>
          {checkingStay ? "Checking session..." : "Stay logged in"}
        </Button>
      </section>
    </div>
  );
}
