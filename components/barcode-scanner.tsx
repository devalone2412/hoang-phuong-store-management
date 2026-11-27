"use client";

import { ScanBarcode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Minimal typing for the (Chromium/Android) native detector; lib.dom doesn't ship it everywhere.
type NativeDetector = { detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type NativeDetectorCtor = {
  new (opts?: { formats?: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};
/** Resolves to the scanned text, or null when no code is visible in this frame. May throw. */
type Decode = (video: HTMLVideoElement) => Promise<string | null>;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];

/** Camera permission and getUserMedia need HTTPS (or localhost). */
const cameraSupported = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/** Native detector, only when it really reads 1D barcodes (some WebKit builds expose it without them). */
async function nativeDecoder(): Promise<Decode | null> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
  if (!Native) return null;
  try {
    const supported = (await Native.getSupportedFormats?.()) ?? [];
    if (!supported.includes("ean_13")) return null;
    const detector = new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
    return async (video) => (await detector.detect(video))[0]?.rawValue || null;
  } catch {
    return null;
  }
}

/**
 * Pure-JS decoder (iOS Safari, Firefox), loaded only when the scanner opens. We own the camera and the frame
 * loop and only borrow zxing's decoder: its built-in video loop sizes its canvas once (iOS often still reports
 * 0x0 then) and permanently stops on the first unexpected error, leaving a live preview that never scans.
 */
async function zxingDecoder(): Promise<Decode> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
  const hints = new Map<number, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF]],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new BrowserMultiFormatReader(hints);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d canvas");

  return async (video) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null; // no frame yet
    // The <video> is shown 4:3 with object-cover: only that crop is visible. Scan its middle band, which is
    // where the guide box sits; fewer pixels decode faster and more reliably than the whole frame.
    const visW = Math.min(vw, (vh * 4) / 3);
    const visH = Math.min(vh, (vw * 3) / 4);
    const w = Math.round(visW);
    const h = Math.round(visH * 0.5);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.drawImage(video, (vw - visW) / 2, (vh - h) / 2, w, h, 0, 0, w, h);
    try {
      return reader.decodeFromCanvas(canvas).getText() || null;
    } catch {
      return null; // NotFound / Checksum / Format: nothing readable in this frame, try the next one
    }
  };
}

/** iOS can resolve play() before the first frame, with videoWidth still 0. */
async function waitForFrame(video: HTMLVideoElement, isCancelled: () => boolean) {
  for (let i = 0; i < 60 && !isCancelled() && !video.videoWidth; i++) await new Promise((r) => setTimeout(r, 50));
}

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
            {/* Short screens (landscape phones) need the room for the camera preview. */}
            <DialogDescription className="[@media(max-height:480px)]:hidden">Đưa mã vạch vào giữa khung hình, cách khoảng 15–20 cm nếu hình bị mờ.</DialogDescription>
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
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stream: MediaStream | undefined;

    const found = (code: string) => {
      if (doneRef.current || !code) return;
      doneRef.current = true;
      navigator.vibrate?.(60);
      onDetectedRef.current(code);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) return;
        // iOS Safari needs these as DOM properties (React doesn't reflect `muted`) or play() is refused.
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();
        await waitForFrame(video, () => cancelled);
        if (cancelled) return;

        const native = await nativeDecoder();
        let decode: Decode = native ?? (await zxingDecoder());
        let usingNative = !!native;
        if (cancelled) return;

        if (!usingNative) {
          // Many phone cameras default to a wide lens that can't focus up close; a little zoom helps.
          const track = stream.getVideoTracks()[0];
          const zoom = (track?.getCapabilities?.() as { zoom?: { max: number } } | undefined)?.zoom;
          if (zoom) await track.applyConstraints({ advanced: [{ zoom: Math.min(1.5, zoom.max) }] } as unknown as MediaTrackConstraints).catch(() => {});
        }

        let failures = 0;
        const tick = async () => {
          if (cancelled || doneRef.current) return;
          try {
            const code = await decode(video);
            failures = 0;
            if (code) return found(code);
          } catch {
            // A native detector that keeps throwing would otherwise leave a preview that never scans.
            if (usingNative && ++failures >= 2) {
              try {
                decode = await zxingDecoder();
                usingNative = false;
              } catch {
                if (!cancelled) setError("Không mở được camera.");
                return;
              }
            }
          }
          if (!cancelled) timer = setTimeout(tick, 150);
        };
        tick();
      } catch (e) {
        if (cancelled) return;
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
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, []);

  if (error) return <p role="alert" className="py-6 text-center text-sm text-destructive">{error}</p>;
  return (
    <div className="relative overflow-hidden rounded-lg bg-black">
      {/* 4:3 on tall screens; on short ones the height is capped and object-cover crops the sides. */}
      <video ref={videoRef} playsInline muted className="aspect-[4/3] max-h-[calc(100svh-9rem)] w-full object-cover" />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-1/3 max-h-24 min-h-12 -translate-y-1/2 rounded-md border-2 border-white/80" />
    </div>
  );
}
