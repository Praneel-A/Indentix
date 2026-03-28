import { ChevronLeft, Flag, QrCode, Share2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { merchantProfile } from "@/data/mock";
import { formatPhone, formatRelativeTime } from "@/lib/utils";
import type { Screen, TrustStatus } from "@/types";
import { RiskIndicator, VerificationBadge } from "@/components/TrustBadge";
import { Badge } from "@/components/ui/badge";

type Props = { onNavigate: (s: Screen) => void };

function TrustStatusBadge({ s }: { s: TrustStatus }) {
  const map: Record<TrustStatus, { variant: "success" | "warning" | "destructive" | "secondary"; label: string }> = {
    good_standing: { variant: "success", label: "Good standing" },
    flagged: { variant: "warning", label: "Flagged" },
    suspended: { variant: "destructive", label: "Suspended" },
    under_review: { variant: "warning", label: "Under review" },
    unknown: { variant: "secondary", label: "Unknown" },
  };
  const m = map[s];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

export function MerchantProfileScreen({ onNavigate }: Props) {
  const m = merchantProfile;
  const initial = m.name.charAt(0).toUpperCase();
  const reportClass = m.reportCount30d === 0 ? "text-emerald-700" : m.reportCount30d <= 2 ? "text-amber-700" : "text-red-700";

  return (
    <div className="px-5 pb-6 pt-4">
      <button type="button" onClick={() => onNavigate("home")} className="mb-4 flex items-center gap-1 text-sm font-medium text-stone-900">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back
      </button>

      <div className="flex gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-xl font-bold text-white">{initial}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">{m.fullName}</h1>
              <p className="font-mono text-sm text-stone-500">{m.id}</p>
            </div>
            <button
              type="button"
              className="flex shrink-0 flex-col items-center rounded-xl border border-stone-200 p-3"
              aria-label="Show QR code"
            >
              <QrCode className="h-6 w-6 text-stone-700" aria-hidden />
              <span className="mt-0.5 text-[10px] font-medium text-stone-600">QR</span>
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <VerificationBadge state={m.verificationState} />
            <TrustStatusBadge s={m.trustStatus} />
          </div>
        </div>
      </div>

      <Separator className="my-5" />

      <RiskIndicator level={m.riskLevel} />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Reports this month</p>
          <p className={`mt-2 text-3xl font-bold ${reportClass}`}>{m.reportCount30d}</p>
          {m.reportCount30d === 0 && <p className="mt-1 text-xs text-stone-500">None on record</p>}
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Total reports</p>
          <p className={`mt-2 text-3xl font-bold ${reportClass}`}>{m.totalReports}</p>
          <p className="mt-1 text-xs text-stone-500">All time</p>
        </div>
      </div>

      <CardList
        rows={[
          { k: "Phone", v: formatPhone(m.phone), mono: true },
          {
            k: "Active since",
            v: new Date(m.activeSince).toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
          },
          { k: "Last active", v: formatRelativeTime(m.lastActive) },
          { k: "Data synced", v: formatRelativeTime(m.lastSynced) },
        ]}
      />

      <section className="mt-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-stone-400">
          <Tag className="h-3.5 w-3.5" aria-hidden />
          Business categories
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {m.categories.map((c) => (
            <span key={c} className="rounded-md border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
              {c}
            </span>
          ))}
        </div>
      </section>

      <div className="mt-6 flex gap-4 rounded-xl border border-stone-200 p-4">
        <div className="grid h-16 w-16 shrink-0 grid-cols-3 gap-0.5 rounded-lg border-2 border-stone-200 p-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={i % 3 === 0 || i === 4 ? "bg-stone-900" : "bg-stone-200"} />
          ))}
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-900">Share identity for in-person transactions</p>
          <p className="mt-1 text-xs text-stone-500">Buyers can scan your code to see this profile before paying.</p>
          <button type="button" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-stone-900 underline">
            <Share2 className="h-4 w-4" aria-hidden />
            Share QR code
          </button>
        </div>
      </div>

      <Button variant="destructive" className="mt-6 w-full" onClick={() => onNavigate("report")}>
        <Flag className="h-4 w-4" aria-hidden />
        Report this merchant
      </Button>
      <Button variant="ghost" className="mt-2 w-full" onClick={() => onNavigate("agent")}>
        Dispute a report — contact agent
      </Button>
    </div>
  );
}

function CardList({ rows }: { rows: { k: string; v: string; mono?: boolean }[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-white">
      {rows.map((r, i) => (
        <div key={r.k} className={`flex justify-between gap-2 px-4 py-3.5 text-sm ${i > 0 ? "border-t border-stone-100" : ""}`}>
          <span className="text-stone-500">{r.k}</span>
          <span className={`text-right text-stone-900 ${r.mono ? "font-mono text-xs" : ""}`}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}
