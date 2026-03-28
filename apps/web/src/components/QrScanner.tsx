import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";

interface Props {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function QrScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const divId = useRef("qr-" + Math.random().toString(36).slice(2, 8));
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const stop = useCallback(() => {
    const s = scannerRef.current;
    if (s) {
      s.stop().catch(() => {});
      try { s.clear(); } catch { /* already cleared */ }
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const el = document.getElementById(divId.current);
    if (!el || started) return;

    const scanner = new Html5Qrcode(divId.current);
    scannerRef.current = scanner;
    setStarted(true);

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 200, height: 200 }, aspectRatio: 1 },
      (text) => {
        scanner.stop().catch(() => {});
        onScanRef.current(text);
      },
      () => {},
    ).catch((err) => {
      setError(typeof err === "string" ? err : err?.message ?? "Cannot access camera. Make sure you're on HTTPS and have granted camera permission.");
    });

    return () => { stop(); };
  }, [started, stop]);

  return (
    <div className="space-y-3">
      <div id={divId.current} className="rounded-xl overflow-hidden bg-slate-900 min-h-[250px]" />
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <p className="font-semibold">Camera error</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      )}
      <Button variant="ghost" className="w-full" onClick={() => { stop(); onClose(); }}>Cancel</Button>
    </div>
  );
}
