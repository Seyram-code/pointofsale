"use client";

import { useEffect, useRef } from "react";

export interface UseBarcodeScannerOptions {
  onScan: (code: string) => void;
  /** Max gap between keystrokes; hardware scanners type far faster than humans. */
  maxKeyIntervalMs?: number;
  minLength?: number;
  enabled?: boolean;
}

/**
 * Listens for keyboard-wedge barcode scanners at the document level.
 * Typing into an input is ignored unless that input opts in with
 * `data-barcode-target="true"`.
 */
export function useBarcodeScanner({
  onScan,
  maxKeyIntervalMs = 40,
  minLength = 4,
  enabled = true,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;
      if (isEditable && target?.dataset.barcodeTarget !== "true") return;

      const now = Date.now();
      if (now - lastKeyTimeRef.current > maxKeyIntervalMs) bufferRef.current = "";
      lastKeyTimeRef.current = now;

      if (event.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (code.length >= minLength) {
          event.preventDefault();
          onScanRef.current(code);
        }
        return;
      }

      if (event.key.length === 1) bufferRef.current += event.key;
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, maxKeyIntervalMs, minLength]);
}
