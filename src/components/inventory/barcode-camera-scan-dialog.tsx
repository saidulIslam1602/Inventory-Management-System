"use client";

import * as React from "react";
import { Camera, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { IScannerControls } from "@zxing/browser";

/** Formats aligned with Chromium's BarcodeDetector; ZXing ignores this list (multi-format). */
const NATIVE_DETECT_FORMATS: string[] = [
  "aztec",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "data_matrix",
  "ean_13",
  "ean_8",
  "itf",
  "pdf417",
  "qr_code",
  "upc_a",
  "upc_e",
];

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect: (image: CanvasImageSource) => Promise<{ rawValue?: string | null }[]>;
    };
  }
}

export function inlineCameraBarcodeScanAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
}

export type BarcodeCameraScanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once a code is decoded; dialog should close via parent state. */
  onDecoded: (rawValue: string) => void;
};

export function BarcodeCameraScanDialog({
  open,
  onOpenChange,
  onDecoded,
}: BarcodeCameraScanDialogProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const onDecodedRef = React.useRef(onDecoded);
  const onOpenChangeRef = React.useRef(onOpenChange);
  const [err, setErr] = React.useState<string | null>(null);
  const [warming, setWarming] = React.useState(false);

  React.useEffect(() => {
    onDecodedRef.current = onDecoded;
    onOpenChangeRef.current = onOpenChange;
  }, [onDecoded, onOpenChange]);

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let rafId = 0;
    let mediaStream: MediaStream | null = null;
    let zxingCtrl: IScannerControls | null = null;
    let decoded = false;

    function stopMediaTracks() {
      cancelAnimationFrame(rafId);
      zxingCtrl?.stop();
      zxingCtrl = null;
      mediaStream?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
      mediaStream = null;
      const video = videoRef.current;
      if (video) {
        video.srcObject = null;
      }
    }

    function finalize(raw: string) {
      const v = raw.trim();
      if (!v || decoded || cancelled) return;
      decoded = true;
      stopMediaTracks();
      onDecodedRef.current(v);
      onOpenChangeRef.current(false);
    }

    async function runNativeBarcodeDetector(video: HTMLVideoElement): Promise<boolean> {
      const BD = typeof window !== "undefined" ? window.BarcodeDetector : undefined;
      if (!BD) return false;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return true;
      }
      mediaStream = stream;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const detector = new BD({ formats: NATIVE_DETECT_FORMATS });
      let lastDetectMs = 0;

      async function tick() {
        if (cancelled || decoded) return;
        const now = performance.now();
        if (now - lastDetectMs >= 220 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          lastDetectMs = now;
          try {
            const codes = await detector.detect(video);
            const raw = codes[0]?.rawValue;
            if (typeof raw === "string" && raw.trim()) {
              finalize(raw);
              return;
            }
          } catch {
            /* frame decode failed — keep scanning */
          }
        }
        rafId = requestAnimationFrame(() => void tick());
      }
      void tick();
      return true;
    }

    async function runZxing(video: HTMLVideoElement): Promise<void> {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        video,
        (result, _scanErr, ctrl) => {
          if (!result?.getText() || decoded || cancelled) return;
          ctrl.stop();
          zxingCtrl = null;
          finalize(result.getText());
        }
      );
      if (cancelled) {
        controls.stop();
        return;
      }
      zxingCtrl = controls;
    }

    async function boot() {
      await Promise.resolve();
      if (cancelled) return;

      setErr(null);
      setWarming(true);
      if (!inlineCameraBarcodeScanAvailable()) {
        setErr("Camera scanning needs HTTPS (or localhost) and camera permission.");
        setWarming(false);
        return;
      }

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => {
          resolve();
        })
      );
      const video = videoRef.current;
      if (!video || cancelled) {
        setWarming(false);
        return;
      }

      try {
        const usedNative =
          typeof window.BarcodeDetector !== "undefined"
            ? await runNativeBarcodeDetector(video)
            : false;

        if (cancelled) {
          stopMediaTracks();
          setWarming(false);
          return;
        }

        if (!usedNative) {
          await runZxing(video);
        }

        setWarming(false);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Camera access was denied. Allow the camera or use a USB wedge scanner instead."
            : e instanceof Error
              ? e.message
              : "Could not open the camera.";
        stopMediaTracks();

        try {
          if (!cancelled && videoRef.current) {
            setErr(`${msg} Trying software decoder…`);
            await runZxing(videoRef.current);
            setErr(null);
            setWarming(false);
          } else {
            setErr(msg);
            setWarming(false);
          }
        } catch {
          setErr(msg);
          setWarming(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      stopMediaTracks();
      queueMicrotask(() => {
        setWarming(false);
        setErr(null);
      });
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 opacity-90" aria-hidden />
            Scan barcode / QR
          </DialogTitle>
          <DialogDescription>
            Point the camera at a barcode or QR code on the carton. Prefer good light and hold
            steady — the code fills the preview when possible.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {err && (
            <Alert variant="destructive">
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}
          <div className="bg-muted/40 relative aspect-[4/3] w-full overflow-hidden rounded-lg border">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              autoPlay
              aria-label="Camera preview for barcode scanning"
            />
            {warming && !err && (
              <div className="bg-background/70 absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs">
                <Loader2 className="text-primary h-8 w-8 animate-spin" aria-hidden />
                <span className="text-muted-foreground">Starting camera…</span>
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Chromium-based browsers use the built-in barcode engine when available; other browsers
            use a software decoder instead.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
