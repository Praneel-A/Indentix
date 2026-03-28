import { AlertTriangle, CheckCircle2, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cachedIdentities, pendingQueue, recentReports } from "@/data/mock";
import { formatPhone, formatRelativeTime } from "@/lib/utils";
import type { ConnectivityStatus, Screen } from "@/types";
import { ReportStatusDot } from "@/components/TrustBadge";
import { VerificationBadge, RiskBadge } from "@/components/TrustBadge";

type Props = { onNavigate: (s: Screen) => void; connectivity: ConnectivityStatus; lastSynced: Date };

export function OfflineModeScreen({ onNavigate, connectivity, lastSynced }: Props) {
  const pendingReports = recentReports.filter((r) => r.status === "pending_sync");

  const hero =
    connectivity === "offline"
      ? { wrap: "bg-slate-900 text-white", border: "border-slate-800", sub: "text-slate-300", pill: "bg-slate-800 text-slate-200" }
      : connectivity === "weak"
        ? { wrap: "bg-amber-50 text-amber-950", border: "border-amber-200", sub: "text-amber-800", pill: "bg-amber-100 text-amber-800" }
        : { wrap: "bg-slate-50", border: "border-slate-200", sub: "text-slate-600", pill: "bg-[#003087]/10 text-[#003087]" };

  return (
    <div className="px-5 pb-6 pt-6">
      <div className={`rounded-xl border p-5 ${hero.border} ${hero.wrap}`}>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${
            connectivity === "offline" ? "bg-white/10" : connectivity === "weak" ? "bg-amber-100" : "bg-[#003087]/10"
          }`}
        >
          {connectivity === "offline" && <WifiOff className="h-6 w-6 opacity-90 text-white" aria-hidden />}
          {connectivity === "weak" && <AlertTriangle className="h-6 w-6 text-amber-700" aria-hidden />}
          {connectivity === "online" && <CheckCircle2 className="h-6 w-6 text-[#003087]" aria-hidden />}
        </div>
        <h1
          className={`mt-4 text-xl font-bold tracking-tight ${
            connectivity === "offline" ? "text-white" : connectivity === "weak" ? "text-amber-950" : "text-[#003087]"
          }`}
        >
          {connectivity === "offline" ? "Offline queue" : connectivity === "weak" ? "Weak signal" : "Connected"}
        </h1>
        <p className={`mt-1 text-sm leading-relaxed ${hero.sub}`}>
          {connectivity === "offline"
            ? "Reports and checks you start now stay on this device until sync."
            : connectivity === "weak"
              ? "Sync may take longer. Your actions are still logged."
              : "You are online. Queue is for items waiting from earlier offline use."}
        </p>
        <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium ${hero.pill}`}>
          Last synced {formatRelativeTime(lastSynced)}
        </span>
      </div>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Pending Reports</h2>
          <Badge variant={pendingQueue.length > 0 ? "warning" : "secondary"}>{pendingQueue.length}</Badge>
        </div>
        {pendingQueue.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden />
            <p className="mt-2 text-sm font-medium text-slate-900">No pending reports</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {pendingQueue.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-slate-500">{p.id}</p>
                  <ReportStatusDot status="pending_sync" />
                  <p className="text-sm text-slate-700">{p.description}</p>
                </div>
                <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-amber-600" aria-hidden />
              </div>
            ))}
          </div>
        )}
        {pendingReports.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">Including {pendingReports.length} from recent activity list.</p>
        )}
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Cached Identities</h2>
          <span className="text-xs text-slate-400">Available offline</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {cachedIdentities.map((r, i) => (
            <div key={r.phone + i} className={`px-4 py-3.5 ${i > 0 ? "border-t border-slate-100" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm text-slate-900">{formatPhone(r.phone)}</p>
                  <p className="text-xs text-slate-500">{r.name ?? "—"}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <VerificationBadge state={r.verificationState} size="sm" />
                  <RiskBadge level={r.riskLevel} size="sm" />
                </div>
              </div>
              <p className={`mt-1 text-xs ${Date.now() - r.lastSynced.getTime() > 3600000 ? "text-amber-700" : "text-slate-400"}`}>
                {formatRelativeTime(r.lastSynced)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Cached data may be outdated. Verify when reconnected.</p>
      </section>

      <Button variant="outline" className="mt-6 w-full" onClick={() => onNavigate("report")}>
        <RefreshCw className="h-4 w-4" aria-hidden />
        File report offline
      </Button>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-relaxed text-slate-700">
        <p className="font-semibold text-slate-900">USSD</p>
        <p className="mt-1">
          No internet? Dial <span className="font-mono font-semibold">*150*88#</span> to report fraud or check identity via your mobile network — no data
          required.
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-relaxed text-slate-700">
        <p className="font-semibold text-slate-900">SMS</p>
        <p className="mt-1">
          Send <span className="font-mono font-semibold">REPORT [number]</span> to <span className="font-mono font-semibold">15088</span> to file a basic fraud
          report by SMS.
        </p>
      </div>
    </div>
  );
}
