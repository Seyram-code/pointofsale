"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistration("/").then((registration) => registration?.unregister()).then(async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.filter((name) => name.startsWith("mypos-pwa-")).map((name) => caches.delete(name)));
      }).catch(() => undefined);
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Ignore registration failures in unsupported or locked-down browser contexts.
    });
  }, []);

  return null;
}
