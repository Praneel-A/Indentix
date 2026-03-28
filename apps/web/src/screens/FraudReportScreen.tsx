import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Flag,
  Paperclip,
  Receipt,
  ShieldAlert,
  WifiOff,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FRAUD_CATEGORIES, categoryLabel, recentPurchases } from "@/data/mock";
import { formatCurrency, formatPhone, formatRelativeTime } from "@/lib/utils";
import type { ConnectivityStatus, FraudCategory, Purchase, Screen } from "@/types";
import { Badge } from "@/components/ui/badge";

type Step = 1 | 2 | 3;

type Form = {
  category: FraudCategory | null;
  selectedPurchase: Purchase | null;
  targetPhone: string;
  amount: string;
  note: string;
};

type Props = {
  onNavigate: (s: Screen) => void;
  connectivity: ConnectivityStatus;
};

export function FraudReportScreen({ onNavigate, connectivity }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [submitted, setSubmitted] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState<Form>({
    category: null,
    selectedPurchase: null,
    targetPhone: "",
    amount: "",
    note: "",
  });

  const titles: Record<Step, string> = {
    1: "What happened?",
    2: "Which transaction?",
    3: "Review report",
  };

  const goBack = () => {
    if (submitted) {
      onNavigate("home");
      return;
    }
    if (step > 1) setStep((s) => (s - 1) as Step);
    else onNavigate("home");
  };

  const selectPurchase = (p: Purchase) => {
    setForm((f) => ({
      ...f,
      selectedPurchase: p,
      targetPhone: p.merchantPhone,
      amount: String(p.amount),
    }));
    setPickerOpen(false);
  };

  const clearPurchase = () => {
    setForm((f) => ({ ...f, selectedPurchase: null }));
  };

  const phoneChange = (v: string) => {
    setForm((f) => ({ ...f, targetPhone: v, selectedPurchase: null }));
  };

  const confirmSubmit = () => {
    setShowWarning(false);
    setSubmitted(true);
  };

  if (submitted) {
    const online = connectivity === "online";
    return (
      <div className="px-5 py-12 text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${online ? "bg-emerald-100" : "bg-amber-100"}`}
        >
          {online ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-700" aria-hidden />
          ) : (
            <WifiOff className="h-8 w-8 text-amber-700" aria-hidden />
          )}
        </div>
        <h2 className="mt-6 text-xl font-bold tracking-tight text-stone-900">{online ? "Report submitted" : "Report queued"}</h2>
        <p className="mt-2 text-sm text-stone-500">
          {online ? "Your report is on the network ledger." : "This report will sync when connectivity returns."}
        </p>
        {online && (
          <div className="mx-auto mt-6 max-w-xs rounded-xl border border-stone-200 bg-stone-50 px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Reference</p>
            <p className="mt-1 font-mono text-base font-semibold text-stone-900">RPT-1250</p>
          </div>
        )}
        <div className="mt-8 flex flex-col gap-2">
          <Button className="w-full" size="lg" onClick={() => onNavigate("home")}>
            Back to home
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => onNavigate("check")}>
            Check another identity
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-6 pt-4">
      <button type="button" onClick={goBack} className="mb-4 flex items-center gap-1 text-sm font-medium text-stone-900">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back
      </button>

      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-stone-400">
        <Flag className="h-3.5 w-3.5" aria-hidden />
        Report Fraud
      </div>
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight text-stone-900">{titles[step]}</h1>
        <span className="shrink-0 text-xs text-stone-400">Step {step} of 3</span>
      </div>
      <Progress value={(step / 3) * 100} className="mt-3" />

      {connectivity !== "online" && (
        <Alert variant="warning" className="mt-4 [&>svg]:text-amber-600">
          <WifiOff className="h-4 w-4" aria-hidden />
          <AlertTitle>Limited connectivity</AlertTitle>
          <AlertDescription>Reports may queue until the device is back online.</AlertDescription>
        </Alert>
      )}

      {step === 1 && (
        <div className="mt-6 space-y-3">
          {FRAUD_CATEGORIES.map((c) => {
            const sel = form.category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={sel}
                onClick={() => setForm((f) => ({ ...f, category: c.id }))}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  sel ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-900"
                }`}
              >
                <p className={`text-sm font-semibold ${sel ? "text-white" : ""}`}>{c.label}</p>
                <p className={`mt-1 text-xs leading-relaxed ${sel ? "text-stone-400" : "text-stone-500"}`}>{c.description}</p>
              </button>
            );
          })}
          <Button className="mt-4 w-full" size="lg" disabled={!form.category} onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
              Select a recent purchase{" "}
              <span className="font-normal normal-case text-stone-400">(or enter manually below)</span>
            </p>
            {!form.selectedPurchase ? (
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="mt-2 flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3.5 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-stone-900">
                  <Receipt className="h-5 w-5 text-stone-500" aria-hidden />
                  Choose from recent purchases…
                </span>
                {pickerOpen ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
              </button>
            ) : (
              <Card className="mt-2 border-2 border-stone-900">
                <CardContent className="p-4">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-semibold text-stone-900">{form.selectedPurchase.merchantName}</p>
                      <p className="text-xs text-stone-500">{form.selectedPurchase.description}</p>
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        {form.selectedPurchase.method.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-stone-900">
                        {formatCurrency(form.selectedPurchase.amount, form.selectedPurchase.currency)}
                      </p>
                      <p className="text-xs text-stone-400">{formatRelativeTime(form.selectedPurchase.date)}</p>
                    </div>
                  </div>
                  <button type="button" className="mt-3 text-xs font-medium text-stone-900 underline" onClick={clearPurchase}>
                    Change
                  </button>
                  <div className="mt-3 border-t border-stone-100 bg-stone-50 px-3 py-2">
                    <p className="font-mono text-xs text-stone-600">{formatPhone(form.selectedPurchase.merchantPhone)}</p>
                    {form.selectedPurchase.merchantId && (
                      <p className="mt-0.5 font-mono text-xs text-stone-500">{form.selectedPurchase.merchantId}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            {pickerOpen && !form.selectedPurchase && (
              <div className="mt-2 overflow-hidden rounded-xl border border-stone-200 bg-white">
                {recentPurchases.map((p, idx) => (
                  <div key={p.id}>
                    {idx > 0 && <Separator />}
                    <button type="button" onClick={() => selectPurchase(p)} className="flex w-full gap-3 px-4 py-3.5 text-left hover:bg-stone-50">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100">
                        <Receipt className="h-4 w-4 text-stone-500" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-900">{p.merchantName}</p>
                        <span className="inline-block rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
                          {p.method.replace("_", " ")}
                        </span>
                        <p className="text-xs text-stone-500">{p.description}</p>
                        <p className="font-mono text-xs text-stone-400">{formatPhone(p.merchantPhone)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-stone-900">{formatCurrency(p.amount, p.currency)}</p>
                        <p className="text-xs text-stone-400">{formatRelativeTime(p.date)}</p>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="shrink-0 text-xs text-stone-400">or enter manually</span>
            <Separator className="flex-1" />
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-stone-700">Phone or merchant ID</label>
              <Input
                className="mt-1.5"
                type="tel"
                placeholder="+255 7XX XXX XXX or TZ-MER-XXXXX"
                value={form.targetPhone}
                onChange={(e) => phoneChange(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700">Amount</label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-500">TZS</span>
                <Input className="pl-14" inputMode="numeric" placeholder="0" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700">Note</label>
              <Textarea
                className="mt-1.5"
                maxLength={500}
                placeholder="What happened, in your own words"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
              <p className="mt-1 text-right text-xs text-stone-400">{form.note.length}/500</p>
            </div>
          </div>

          <button
            type="button"
            className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center"
          >
            <Paperclip className="h-5 w-5 text-stone-500" aria-hidden />
            <span className="text-sm font-medium text-stone-900">Attach evidence</span>
            <span className="text-xs text-stone-500">Photo, screenshot, or receipt. Optional, 5 MB max.</span>
          </button>

          <Button className="w-full" size="lg" disabled={!form.targetPhone.trim()} onClick={() => setStep(3)}>
            Continue
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="mt-6 space-y-4">
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <p className="border-b border-stone-100 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-stone-400">Report summary</p>
            <div className="divide-y divide-stone-100 px-4 py-2 text-sm">
              <Row k="Type" v={form.category ? categoryLabel(form.category) : "—"} />
              <Row
                k="Purchase"
                v={
                  form.selectedPurchase
                    ? `${form.selectedPurchase.id} — ${form.selectedPurchase.description}`
                    : "Not linked to a purchase"
                }
              />
              <Row k="Party reported" v={form.targetPhone || "—"} mono />
              <Row k="Amount" v={form.amount ? formatCurrency(Number(form.amount.replace(/\D/g, "") || 0)) : "—"} />
              <Row k="Note" v={form.note || "—"} />
              <Row k="Submit mode" v={connectivity === "online" ? "Live submission" : "Queued for sync"} />
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-amber-900">False reports reduce your trust score</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">
                  Submitting a report that is found to be false or malicious will result in a{" "}
                  <strong className="font-semibold">−15 point trust score penalty</strong> and may lead to account suspension.
                  Only submit genuine incidents.
                </p>
              </div>
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={() => setShowWarning(true)}>
            Submit report
          </Button>
        </div>
      )}

      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-7 w-7 text-red-600" aria-hidden />
            </div>
            <DialogTitle className="text-center">Confirm this report is genuine</DialogTitle>
            <DialogDescription className="text-center">
              Filing a false or misleading report is a violation of network policy.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
            <div className="flex justify-between border-b border-red-100 py-2">
              <span className="text-red-800">Trust score penalty</span>
              <span className="font-bold text-red-700">−15 points</span>
            </div>
            <div className="flex justify-between border-b border-red-100 py-2">
              <span className="text-red-800">Repeat offences</span>
              <span className="font-bold text-red-700">Account suspended</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-red-800">Malicious reports</span>
              <span className="font-bold text-red-700">Permanent ban</span>
            </div>
          </div>
          <p className="text-center text-xs text-stone-400">
            By submitting, you confirm that this report reflects a genuine incident to the best of your knowledge.
          </p>
          <DialogFooter>
            <Button variant="destructive" size="lg" className="w-full" onClick={confirmSubmit}>
              I confirm — submit report
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setShowWarning(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:justify-between">
      <span className="text-stone-500">{k}</span>
      <span className={`text-stone-900 ${mono ? "font-mono text-xs" : ""}`}>{v}</span>
    </div>
  );
}
