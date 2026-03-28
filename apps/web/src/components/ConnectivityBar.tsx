import { Wifi, WifiOff, AlertTriangle, RefreshCw } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ConnectivityStatus } from "@/types";

type Props = {
  status: ConnectivityStatus;
  lastSynced?: Date;
  onCycle: () => void;
};

export function ConnectivityBar({ status, lastSynced, onCycle }: Props) {
  const syncLabel = lastSynced ? `Synced ${formatRelativeTime(lastSynced)}` : "Connected";

  return (
    <button
      type="button"
      onClick={onCycle}
      title="Click to cycle connectivity state (demo)"
      className={cn(
        "w-full border-b text-left transition-colors",
        status === "online" && "border-stone-100 bg-white",
        status === "weak" && "border-amber-200 bg-amber-50",
        status === "offline" && "border-stone-800 bg-stone-900",
      )}
      role="status"
      aria-label={`Network status: ${status}. ${status === "online" ? syncLabel : status === "weak" ? "Weak signal" : "Offline mode"}. Click to cycle demo state.`}
    >
      <div className="flex items-center justify-between gap-2 px-5 py-2.5">
        {status === "online" && (
          <>
            <div className="flex items-center gap-2">
              <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden />
              <span className="text-xs text-stone-500">{syncLabel}</span>
            </div>
          </>
        )}
        {status === "weak" && (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
              <span className="text-xs font-medium text-amber-800">Weak signal — actions may be delayed</span>
            </div>
            {lastSynced && <span className="shrink-0 text-xs text-amber-600">{formatRelativeTime(lastSynced)}</span>}
          </>
        )}
        {status === "offline" && (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <WifiOff className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden />
              <span className="text-xs font-medium text-stone-300">Offline — reports queued for sync</span>
            </div>
            <RefreshCw className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
          </>
        )}
      </div>
    </button>
  );
}
