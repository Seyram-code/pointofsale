"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Ignore registration failures in unsupported or locked-down browser contexts.
    });
  }, []);

  return null;
}
