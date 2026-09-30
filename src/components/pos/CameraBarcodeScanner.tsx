"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/Button";

type BarcodeDetectorResult = { rawValue?: string };
type BarcodeDetectorInstance = { detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

interface CameraBarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

export function CameraBarcodeScanner({ open, onClose, onDetected }: CameraBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let animationFrame = 0;

    async function startScanner() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access is not supported by this browser.");
        return;
      }

      try {
        const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
        if (!Detector) {
          const reader = new BrowserMultiFormatReader();
          const video = videoRef.current;
          if (!video) return;
          zxingControlsRef.current = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: "environment" } }, audio: false },
            video,
            (result) => {
              const barcode = result?.getText();
              if (barcode) {
                onDetected(barcode);
                onClose();
              }
            },
          );
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        detectorRef.current = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"] });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const scan = async () => {
          if (cancelled || !videoRef.current || !detectorRef.current) return;
          try {
            const results = await detectorRef.current.detect(videoRef.current);
            const barcode = results.find((result) => result.rawValue)?.rawValue;
            if (barcode) {
              onDetected(barcode);
              onClose();
              return;
            }
          } catch {
            // Keep scanning while the camera is still warming up or moving.
          }
          animationFrame = requestAnimationFrame(() => void scan());
        };

        animationFrame = requestAnimationFrame(() => void scan());
      } catch {
        setError("Camera permission was denied or the camera is unavailable.");
      }
    }

    void startScanner();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      zxingControlsRef.current?.stop();
      zxingControlsRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      detectorRef.current = null;
    };
  }, [onClose, onDetected, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-panel)]">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Camera className="size-5 text-brand-600" />
          <p className="flex-1 font-semibold text-fg">Scan barcode</p>
          <button type="button" onClick={onClose} aria-label="Close camera scanner" className="rounded-lg p-2 text-fg-muted hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>
        <div className="relative aspect-[4/3] bg-black">
          <video ref={videoRef} className="size-full object-cover" muted playsInline />
          <span className="pointer-events-none absolute inset-x-10 top-1/2 border-t-2 border-brand-400" />
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm text-fg-secondary">Point the camera at a product barcode.</p>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>}
          <Button type="button" variant="outline" fullWidth onClick={onClose}>Use barcode field instead</Button>
        </div>
      </div>
    </div>
  );
}