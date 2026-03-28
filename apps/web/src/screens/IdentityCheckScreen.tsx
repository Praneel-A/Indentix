import { useState } from "react";
import { AlertCircle, ChevronLeft, Clock, QrCode, RefreshCw, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cachedIdentities, identityResults } from "@/data/mock";
import { formatPhone, formatRelativeTime } from "@/lib/utils";
import type { ConnectivityStatus, IdentityResult, Screen } from "@/types";
import { RiskBadge, RiskIndicator, VerificationBadge } from "@/components/TrustBadge";
import { useToast } from "@/components/ui/toast";

type Props = { onNavigate: (s: Screen) => void; connectivity: ConnectivityStatus };

function normalizeQ(q: string): string {
  return q.replace(/\s/g, "").toLowerCase();
}

function findIdentity(pool: IdentityResult[], q: string): IdentityResult | null {
  const n = normalizeQ(q);
  if (!n) return null;
  return pool.find((r) => normalizeQ(r.phone).includes(n) || (r.merchantId && normalizeQ(r.merchantId).includes(n))) ?? null;
}

export function IdentityCheckScreen({ onNavigate, connectivity }: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IdentityResult | null>(null);
  const [searched, setSearched] = useState(false);

  const pool = connectivity === "online" ? identityResults : cachedIdentities;

  const runSearch = () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setResult(null);
    window.setTimeout(() => {
      setResult(findIdentity(pool, query));
      setLoading(false);
    }, 550);
  };

  const reportCountClass = (n: number) => {
    if (n === 0) return "text-emerald-700";
    if (n === 1) return "text-amber-700";
    return "text-red-700";
  };

  return (
    <div className="px-5 pb-6 pt-4">
      <button type="button" onClick={() => onNavigate("home")} className="mb-4 flex items-center gap-1 text-sm font-medium text-stone-900">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back
      </button>
      <h1 className="text-xl font-bold tracking-tight text-stone-900">Check Identity</h1>
      <p className="mt-1 text-sm text-stone-500">Search phone or merchant ID before you pay.</p>

      <div className="mt-5 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
          <Input
            className="pl-11"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
        </div>
        <Button
          type="button"
          className="h-12 w-12 shrink-0 p-0"
          disabled={!query.trim()}
          onClick={runSearch}
          aria-label="Search"
        >
          <Search className="h-5 w-5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-12 shrink-0 p-0"
          aria-label="Scan QR code"
          onClick={() => toast({ title: "QR scan", description: "Camera QR capture is not enabled in this build.", variant: "default" })}
        >
          <QrCode className="h-5 w-5" aria-hidden />
        </Button>
      </div>

      {connectivity !== "online" && searched && (
        <Alert variant="warning" className="mt-4">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <AlertDescription>Showing cached data only. Live check not available offline.</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="mt-6 space-y-3" aria-busy="true" aria-label="Loading identity result">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      )}

      {!loading && searched && result && (
        <div className="mt-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-base font-semibold text-stone-900">{formatPhone(result.phone)}</p>
              {result.merchantId && <p className="font-mono text-xs text-stone-500">{result.merchantId}</p>}
              {result.name && (
                <p className="mt-1 flex items-center gap-1 text-sm text-stone-700">
                  <User className="h-4 w-4 text-stone-400" aria-hidden />
                  {result.name}
                </p>
              )}
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-12 w-12 shrink-0" aria-label="Refresh" onClick={runSearch}>
              <RefreshCw className="h-4 w-4" aria-hidden />
            </Button>
          </div>

          <RiskIndicator level={result.riskLevel} />

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Identity</p>
              <div className="mt-2">
                <VerificationBadge state={result.verificationState} />
              </div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Reports (30 days)</p>
              <p className={`mt-2 text-3xl font-bold ${reportCountClass(result.reportCount30d)}`}>{result.reportCount30d}</p>
            </div>
          </div>

          <Card>
            <CardContent className="divide-y divide-stone-100 px-5 py-0">
              <div className="flex justify-between py-3.5 text-sm">
                <span className="text-stone-500">Total reports on record</span>
                <span className="font-medium text-stone-900">{result.totalReports}</span>
              </div>
              {result.activeSince && (
                <div className="flex justify-between py-3.5 text-sm">
                  <span className="text-stone-500">Active since</span>
                  <span className="text-stone-900">
                    {new Date(result.activeSince).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between py-3.5 text-sm">
                <span className="text-stone-500">Last synced</span>
                <span className={`flex items-center gap-1 font-medium ${result.isFromCache ? "text-amber-700" : "text-stone-900"}`}>
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {formatRelativeTime(result.lastSynced)}
                  {result.isFromCache && <span className="text-xs">(cache)</span>}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-sm leading-relaxed text-stone-700">
            Risk signal only. This result reflects reports filed in this network and cached signals. It is not legal or financial advice.
          </div>

          <Button variant="destructive" className="w-full" onClick={() => onNavigate("report")}>
            Report this number
          </Button>
        </div>
      )}

      {!loading && searched && !result && (
        <div className="mt-6">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-medium text-stone-900">No match</p>
              <p className="mt-1 text-sm text-stone-500">Try another number or pick a recent check below.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {(!searched || !result) && (
        <section className="mt-7">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">How to check</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-stone-700">
            <li>Enter the seller&apos;s M-Pesa or Airtel Money number.</li>
            <li>Review risk level and verification before you send cash.</li>
            <li>File a report if something looks wrong.</li>
          </ol>

          <h2 className="mt-6 text-xs font-semibold uppercase tracking-widest text-stone-400">Recent checks</h2>
          <div className="mt-2 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {identityResults.map((r, i) => (
              <button
                key={r.phone + i}
                type="button"
                onClick={() => {
                  setQuery(r.phone);
                  setSearched(true);
                  setResult(r);
                }}
                className="flex w-full items-center justify-between gap-2 border-t border-stone-100 px-4 py-3.5 text-left first:border-t-0 hover:bg-stone-50"
              >
                <div>
                  <p className="font-mono text-sm text-stone-900">{formatPhone(r.phone)}</p>
                  <p className="text-xs text-stone-500">{r.name ?? "No name on file"}</p>
                </div>
                <RiskBadge level={r.riskLevel} size="sm" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
