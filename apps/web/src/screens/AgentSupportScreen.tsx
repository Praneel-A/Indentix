import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  FileText,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { agentActions } from "@/data/mock";
import { formatRelativeTime } from "@/lib/utils";
import type { Screen } from "@/types";

type Props = { onNavigate: (s: Screen) => void };

const actionBadge = (t: string) => {
  if (t === "report_submission") return <Badge className="border-red-200 bg-red-50 text-red-800">Report</Badge>;
  if (t === "identity_check") return <Badge variant="secondary">Identity</Badge>;
  if (t === "onboarding") return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Onboarding</Badge>;
  return <Badge className="border-amber-200 bg-amber-50 text-amber-800">Escalation</Badge>;
};

export function AgentSupportScreen({ onNavigate }: Props) {
  const [sessionActive, setSessionActive] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="px-5 pb-6 pt-4">
      <button type="button" onClick={() => onNavigate("home")} className="mb-4 flex items-center gap-1 text-sm font-medium text-stone-900">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back
      </button>
      <h1 className="text-xl font-bold tracking-tight text-stone-900">Agent Support</h1>
      <p className="mt-1 text-sm text-stone-500">Assisted sessions and audit trail.</p>

      {!sessionActive ? (
        <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-stone-100">
            <UserCheck className="h-6 w-6 text-stone-600" aria-hidden />
          </div>
          <p className="mt-4 text-base font-semibold text-stone-900">Request agent assistance</p>
          <p className="mt-1 text-sm leading-relaxed text-stone-500">
            Start a timed session so a field agent can verify your identity and file actions on your behalf.
          </p>
          <Button className="mt-4 w-full" size="lg" onClick={() => setSessionActive(true)}>
            Start assisted session
          </Button>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Session active</p>
          <p className="mt-1 text-xs text-emerald-600">Session code</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-emerald-900">AGT-4471</p>
          <p className="mt-3 text-sm leading-relaxed text-emerald-900">
            Share this code only with a verified Salama agent. This session may be recorded for audit.
          </p>
          <Button variant="outline" className="mt-4 w-full border-emerald-300 text-emerald-900 hover:bg-emerald-100" onClick={() => setSessionActive(false)}>
            End session
          </Button>
        </div>
      )}

      <section className="mt-7">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Agent-assisted actions</h2>
        <div className="mt-3 space-y-3">
          {[
            { icon: FileText, title: "Joint report filing", body: "Agent validates your story and attaches evidence." },
            { icon: UserCheck, title: "In-person identity check", body: "Agent confirms ID documents against network records." },
            { icon: CheckCircle2, title: "Merchant onboarding", body: "Agent captures business details for trust baseline." },
            { icon: AlertCircle, title: "Escalation", body: "Complex cases routed to regional review." },
          ].map((x) => (
            <div key={x.title} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex gap-3">
                <x.icon className="h-5 w-5 shrink-0 text-stone-500" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-stone-900">{x.title}</p>
                  <p className="mt-1 text-sm text-stone-500">{x.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Audit trail</h2>
          <Badge variant="secondary">{agentActions.length}</Badge>
        </div>
        <Alert variant="info" className="mb-3">
          <AlertTitle>Logged actions</AlertTitle>
          <AlertDescription>Every assisted action is stored with agent code and timestamp.</AlertDescription>
        </Alert>
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          {agentActions.map((a, i) => {
            const open = expanded === a.id;
            return (
              <div key={a.id}>
                {i > 0 && <Separator />}
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : a.id)}
                  className="flex w-full flex-col gap-2 px-4 py-3.5 text-left hover:bg-stone-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs text-stone-400">{a.id}</span>
                    {open ? <ChevronUp className="h-4 w-4 shrink-0 text-stone-400" aria-hidden /> : <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" aria-hidden />}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">{actionBadge(a.actionType)}</div>
                  <p className="text-sm font-medium text-stone-900">{a.description}</p>
                  <p className="flex items-center gap-1 text-xs text-stone-500">
                    <UserCheck className="h-3.5 w-3.5" aria-hidden />
                    {a.agentName} · {a.agentCode}
                  </p>
                  <p className="text-xs text-stone-400">{formatRelativeTime(a.performedAt)}</p>
                  {open && a.notes && (
                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Agent note</p>
                      <p className="mt-1 text-sm text-stone-700">{a.notes}</p>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
