import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";

interface Props {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function QrScanner({ onScan, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = "qr-reader-" + Math.random().toString(36).slice(2, 8);
    const el = containerRef.current;
    if (!el) return;

    const div = document.createElement("div");
    div.id = id;
    el.appendChild(div);

    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (text) => {
          scanner.stop().catch(() => {});
          onScan(text);
        },
        () => {},
      )
      .catch((err) => {
        setError(typeof err === "string" ? err : err?.message ?? "Camera error");
      });

    return () => {
      scanner.stop().catch(() => {});
      scanner.clear();
      div.remove();
    };
  }, [onScan]);

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="rounded-xl overflow-hidden bg-slate-900" />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Button variant="ghost" className="w-full" onClick={onClose}>Cancel</Button>
    </div>
  );
}
