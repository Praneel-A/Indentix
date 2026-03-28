import { Shield, ShieldAlert, ShieldCheck, ShieldOff, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportStatus, RiskLevel, VerificationState } from "@/types";

const riskConfig: Record<
  RiskLevel,
  { className: string; Icon: typeof Shield; label: string; desc: string }
> = {
  low: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    Icon: ShieldCheck,
    label: "Low Risk",
    desc: "No significant flags in the network",
  },
  medium: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    Icon: ShieldAlert,
    label: "Medium Risk",
    desc: "Some flags — proceed with caution",
  },
  high: {
    className: "border-red-200 bg-red-50 text-red-800",
    Icon: ShieldX,
    label: "High Risk",
    desc: "Multiple reports — do not transact",
  },
  unknown: {
    className: "border-stone-200 bg-stone-100 text-stone-700",
    Icon: Shield,
    label: "No data",
    desc: "No prior data available",
  },
};

type RiskBadgeProps = { level: RiskLevel; size?: "sm" | "md" | "lg"; showLabel?: boolean };

export function RiskBadge({ level, size = "md", showLabel = true }: RiskBadgeProps) {
  const c = riskConfig[level];
  const Icon = c.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium",
        c.className,
        size === "sm" && "text-[10px]",
        size === "md" && "text-xs",
        size === "lg" && "text-sm",
      )}
    >
      <Icon className={cn("shrink-0", size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4")} aria-hidden />
      {showLabel && <span>{c.label}</span>}
    </span>
  );
}

type VerProps = { state: VerificationState; size?: "sm" | "md" };

export function VerificationBadge({ state, size = "md" }: VerProps) {
  const map: Record<VerificationState, { className: string; Icon: typeof Shield; label: string }> = {
    verified: { className: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: ShieldCheck, label: "Verified" },
    not_verified: { className: "border-stone-200 bg-stone-100 text-stone-600", Icon: ShieldOff, label: "Not verified" },
    pending: { className: "border-stone-200 bg-stone-100 text-stone-600", Icon: Shield, label: "Unknown" },
    unknown: { className: "border-stone-200 bg-stone-100 text-stone-600", Icon: Shield, label: "Unknown" },
  };
  const m = map[state];
  const Icon = m.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium",
        m.className,
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5",
      )}
    >
      <Icon className={cn("shrink-0", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} aria-hidden />
      {m.label}
    </span>
  );
}

const riskWrap: Record<RiskLevel, string> = {
  low: "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900",
  medium: "rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900",
  high: "rounded-xl border border-red-200 bg-red-50 p-4 text-red-900",
  unknown: "rounded-xl border border-stone-200 bg-stone-100 p-4 text-stone-800",
};

export function RiskIndicator({ level }: { level: RiskLevel }) {
  const c = riskConfig[level];
  const Icon = c.Icon;
  return (
    <div className={riskWrap[level]}>
      <div className="flex gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/70">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <p className="text-base font-semibold leading-tight">{c.label}</p>
          <p className="mt-1 text-sm leading-relaxed text-stone-700">{c.desc}</p>
        </div>
      </div>
    </div>
  );
}

export function ReportStatusDot({ status }: { status: ReportStatus }) {
  const cfg: Record<ReportStatus, { dot: string; label: string }> = {
    synced: { dot: "bg-emerald-500", label: "Synced" },
    pending_sync: { dot: "bg-amber-500", label: "Pending sync" },
    failed_sync: { dot: "bg-red-500", label: "Failed sync" },
    draft: { dot: "bg-stone-400", label: "Draft" },
  };
  const c = cfg[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", c.dot)} aria-hidden />
      {c.label}
    </span>
  );
}
