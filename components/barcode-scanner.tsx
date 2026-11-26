"use client";

import { ScanBarcode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Minimal typing for the (Chromium/Android) native detector; lib.dom doesn't ship it everywhere.
type NativeDetector = { detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type NativeDetectorCtor = new (opts?: { formats?: string[] }) => NativeDetector;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];

/** Camera permission and getUserMedia need HTTPS (or localhost). */
const cameraSupported = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/** Button + dialog. Calls `onDetected` once with the scanned code, then closes. */
export function BarcodeScanButton({ onDetected, className }: { onDetected: (code: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="icon" className={className} aria-label="Quét mã vạch bằng camera" onClick={() => setOpen(true)}>
        <ScanBarcode />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quét mã vạch</DialogTitle>
            <DialogDescription>Đưa mã vạch vào giữa khung hình.</DialogDescription>
          </DialogHeader>
          {open && (
            <Scanner
              onDetected={(code) => {
                setOpen(false);
                onDetected(code);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Scanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(cameraSupported() ? null : "Trình duyệt không hỗ trợ camera (cần HTTPS).");
  const doneRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!cameraSupported()) return;
    const video = videoRef.current!;
    let stop = () => {};
    let cancelled = false;

    const found = (code: string) => {
      if (doneRef.current || !code) return;
      doneRef.current = true;
      navigator.vibrate?.(60);
      onDetectedRef.current(code);
    };

    (async () => {
      try {
        const Native = (globalThis as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
        if (Native) {
          const detector = new Native({ formats: FORMATS });
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
          if (cancelled) return stream.getTracks().forEach((t) => t.stop());
          video.srcObject = stream;
          await video.play();
          let timer: ReturnType<typeof setTimeout>;
          const tick = async () => {
            if (cancelled || doneRef.current) return;
            const hits = await detector.detect(video).catch(() => []);
            if (hits[0]) found(hits[0].rawValue);
            else timer = setTimeout(tick, 150);
          };
          tick();
          stop = () => {
            clearTimeout(timer);
            stream.getTracks().forEach((t) => t.stop());
          };
        } else {
          // iOS Safari, Firefox: pure-JS decoder, loaded only when the scanner opens.
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import("@zxing/browser"),
            import("@zxing/library"),
          ]);
          const hints = new Map([
            [
              DecodeHintType.POSSIBLE_FORMATS,
              [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF],
            ],
          ]);
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
          const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, video, (result) => {
            if (result) found(result.getText());
          });
          if (cancelled) controls.stop();
          else stop = () => controls.stop();
        }
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Chưa cho phép dùng camera. Hãy cấp quyền camera cho trang này rồi thử lại."
            : name === "NotFoundError"
              ? "Không tìm thấy camera trên thiết bị này."
              : "Không mở được camera.",
        );
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  if (error) return <p role="alert" className="py-6 text-center text-sm text-destructive">{error}</p>;
  return (
    <div className="relative overflow-hidden rounded-lg bg-black">
      <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-md border-2 border-white/80" />
    </div>
  );
}
