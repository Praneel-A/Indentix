import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, useConnect, useDisconnect, useReadContract, useSignMessage, useSwitchChain } from "wagmi";
import { SiweMessage } from "siwe";
import { polygonAmoy } from "wagmi/chains";
import { apiFetch, clearToken, getToken, setToken } from "./api";
import { subjectIdFromWallet } from "./lib/subject";
import { attestationHubAbi } from "./abi/attestationHub";
import { hasBrowserWalletProvider, walletConnectEnabled } from "./wagmi";
import { FaceScanner } from "./components/FaceScanner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ScanFace, FileCheck, Search, AlertTriangle, LogOut, User, Activity } from "lucide-react";

const HUB = import.meta.env.VITE_ATTESTATION_HUB_ADDRESS as `0x${string}` | undefined;

type MeData = {
  wallet: string; didHash?: string; faceCommitmentHash?: string; faceEnrolledAt?: string;
  applicant?: { status: string; externalId: string; reviewedAt?: string };
  risk?: { tier: string; eddRequired: boolean; eddStatus?: string };
  trust?: { score: number; level: string; breakdown: Record<string, number> };
  kycSessions?: { status: string; createdAt: string }[];
  recentJobs?: { kind: string; status: string; txHash?: string; createdAt: string }[];
};

type LookupData = {
  wallet: string; faceEnrolled: boolean; faceCommitmentHash?: string;
  kyc: string; riskTier?: string;
  trust: { score: number; level: string; breakdown: Record<string, number> };
  memberSince: string;
};

export function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: connectPending, error: connectError, reset: resetConnect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switchPending } = useSwitchChain();
  const { signMessageAsync, isPending: signPending } = useSignMessage();

  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [me, setMe] = useState<MeData | null>(null);
  const [onboarding, setOnboarding] = useState<{ applicantId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState("USA");
  const [eddApproved, setEddApproved] = useState(false);
  const [lookupAddr, setLookupAddr] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupData | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const subjectId = address && HUB ? subjectIdFromWallet(address) : undefined;
  const { data: onChainAtt, refetch: refetchAtt } = useReadContract({ address: HUB, abi: attestationHubAbi, functionName: "attestations", args: subjectId ? [subjectId] : undefined, query: { enabled: Boolean(HUB && subjectId) } });

  useEffect(() => { setTokenState(getToken()); }, []);
  useEffect(() => { if (connectError?.message) setError(connectError.message.includes("Provider not found") ? "No wallet detected. Use Dev login." : connectError.message); }, [connectError]);

  const refreshMe = useCallback(async () => {
    const res = await apiFetch("/me");
    if (res.ok) setMe(await res.json() as MeData); else setMe(null);
  }, []);

  useEffect(() => { if (token) void refreshMe(); else setMe(null); }, [token, refreshMe]);

  const handleDevLogin = async () => {
    setError(null);
    try {
      const res = await fetch("/dev/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) { setError(((await res.json()) as { error?: string }).error ?? "Failed"); return; }
      const { token: t } = (await res.json()) as { token: string };
      setToken(t); setTokenState(t); await refreshMe();
    } catch { setError("Network error."); }
  };

  const handleSignIn = async () => {
    if (!address) return; setError(null);
    try { if (chainId !== polygonAmoy.id) await switchChain({ chainId: polygonAmoy.id }); } catch { setError("Switch to Amoy first."); return; }
    try {
      const nr = await fetch(`/auth/nonce?address=${encodeURIComponent(address)}`);
      if (!nr.ok) { setError("Nonce failed"); return; }
      const { nonce } = (await nr.json()) as { nonce: string };
      const siwe = new SiweMessage({ domain: window.location.host, address, statement: "Sign in to Indentix", uri: window.location.origin, version: "1", chainId: polygonAmoy.id, nonce });
      const signature = await signMessageAsync({ message: siwe.prepareMessage() });
      const vr = await fetch("/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: siwe.prepareMessage(), signature }) });
      const j = (await vr.json()) as { token?: string; error?: string };
      if (!vr.ok || !j.token) { setError(j.error ?? "Verify failed"); return; }
      setToken(j.token); setTokenState(j.token); await refreshMe();
    } catch (e) { setError(e instanceof Error ? e.message : "Sign-in failed."); }
  };

  const logout = () => { clearToken(); setTokenState(null); setMe(null); setOnboarding(null); disconnect(); };
  const kycApplicantId = onboarding?.applicantId ?? me?.applicant?.externalId;

  const startOnboarding = async () => {
    setError(null);
    try { const res = await apiFetch("/onboarding/start", { method: "POST", body: JSON.stringify({}) }); const j = await res.json(); if (!res.ok) { setError((j as { error?: string }).error ?? "Failed"); return; } setOnboarding(j as { applicantId: string }); await refreshMe(); } catch { setError("Network error."); }
  };

  const mockKyc = async (review: "approved" | "rejected") => {
    if (!kycApplicantId) { setError("Start KYC first."); return; } setError(null);
    try {
      const needsEdd = ["IRN", "PRK", "MMR", "SYR"].includes(country);
      const res = await apiFetch("/dev/mock-kyc", { method: "POST", body: JSON.stringify({ applicantId: kycApplicantId, reviewStatus: review, countryCode: country, eddApproved: needsEdd ? eddApproved : undefined }) });
      const j = await res.json(); if (!res.ok) { setError((j as { error?: string }).error ?? "Failed"); return; }
      setOnboarding(null); await refreshMe(); await refetchAtt();
    } catch { setError("Network error."); }
  };

  const revokeIdentity = async () => {
    if (!confirm("Revoke identity? Face data will be cleared.")) return; setError(null);
    try { const res = await apiFetch("/identity/revoke", { method: "POST", body: JSON.stringify({}) }); if (!res.ok) { setError("Revoke failed"); return; } await refreshMe(); } catch { setError("Network error."); }
  };

  const doLookup = async () => {
    setLookupError(null); setLookupResult(null);
    if (!lookupAddr.trim()) { setLookupError("Enter a wallet address."); return; }
    try { const res = await fetch(`/lookup/${encodeURIComponent(lookupAddr.trim())}`); const j = await res.json(); if (!res.ok) { setLookupError((j as { error?: string }).error ?? "Not found"); return; } setLookupResult(j as LookupData); } catch { setLookupError("Network error."); }
  };

  const loggedIn = Boolean(token);
  const faceEnrolled = Boolean(me?.faceCommitmentHash);
  const kycStatus = me?.applicant?.status;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Indentix</h1>
        <p className="text-sm text-slate-500">Portable trust layer — Polygon Amoy</p>
      </div>

      {/* ── Login ── */}
      {!loggedIn && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-4 h-4" /> Connect wallet</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!isConnected ? (
                <Button disabled={connectPending} onClick={() => { setError(null); resetConnect(); const c = connectors[0]; if (c && hasBrowserWalletProvider()) connect({ connector: c }); else if (walletConnectEnabled()) { const wc = connectors.find(x => x.id === "walletConnect"); if (wc) connect({ connector: wc }); } else setError("No wallet. Use Dev login."); }}>
                  {connectPending ? "Connecting…" : "Connect wallet"}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-slate-500">{address}</code>
                  <Button variant="outline" size="sm" onClick={() => disconnect()}>Disconnect</Button>
                </div>
              )}
              {isConnected && chainId !== polygonAmoy.id && <Button size="sm" disabled={switchPending} onClick={() => switchChain({ chainId: polygonAmoy.id })}>Switch to Amoy</Button>}
              {isConnected && <Button disabled={signPending || chainId !== polygonAmoy.id} onClick={() => void handleSignIn()}>Sign in (SIWE)</Button>}
            </CardContent>
          </Card>
          <Card className="border-indigo-200">
            <CardHeader><CardTitle>Dev login</CardTitle><CardDescription>No wallet needed.</CardDescription></CardHeader>
            <CardContent><Button onClick={() => void handleDevLogin()}>Dev login</Button></CardContent>
          </Card>
        </div>
      )}

      {/* ── Dashboard ── */}
      {loggedIn && me && (
        <div className="space-y-4">
          {/* Trust header */}
          <Card>
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TrustScoreRing score={me.trust?.score ?? 0} level={me.trust?.level ?? "UNVERIFIED"} />
                  <div>
                    <p className="text-sm font-semibold">{me.trust?.level ?? "UNVERIFIED"}</p>
                    <p className="text-xs text-slate-400">{me.wallet.slice(0, 6)}…{me.wallet.slice(-4)}</p>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4 mr-1" />Sign out</Button>
            </CardContent>
          </Card>

          {/* Steps */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex justify-around text-center">
                {[
                  { icon: <ScanFace className="w-5 h-5" />, label: "Face ID", done: faceEnrolled },
                  { icon: <FileCheck className="w-5 h-5" />, label: "KYC", done: kycStatus === "APPROVED" },
                  { icon: <ShieldCheck className="w-5 h-5" />, label: "Trusted", done: faceEnrolled && kycStatus === "APPROVED" },
                ].map((s, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.done ? "bg-green-500 text-white" : "bg-slate-100 text-slate-400"}`}>{s.done ? "✓" : s.icon}</div>
                    <span className={`text-xs font-semibold ${s.done ? "text-green-600" : "text-slate-400"}`}>{s.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Face */}
          <FaceIdentityCard enrolled={faceEnrolled} faceHash={me.faceCommitmentHash} onChanged={() => void refreshMe()} />

          {/* KYC */}
          {!faceEnrolled ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck className="w-4 h-4" /> KYC / CDD / EDD</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-slate-500">Enroll your face first to unlock KYC.</p></CardContent>
            </Card>
          ) : (
            <KycCard applicant={me.applicant} risk={me.risk} hasApplicant={Boolean(kycApplicantId)} onStart={() => void startOnboarding()} onApprove={() => void mockKyc("approved")} onReject={() => void mockKyc("rejected")} country={country} onCountryChange={setCountry} eddApproved={eddApproved} onEddChange={setEddApproved} />
          )}

          {/* Activity */}
          <ActivityCard sessions={me.kycSessions} jobs={me.recentJobs} />

          {/* Profile */}
          <Card>
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div><span className="font-medium">Wallet:</span> <code className="text-xs text-slate-400">{me.wallet}</code></div>
              <div><span className="font-medium">Face:</span> {me.faceCommitmentHash ? <><Badge variant="success">Enrolled</Badge> <code className="text-xs text-slate-400 ml-1">{me.faceCommitmentHash.slice(0, 18)}…</code></> : <Badge variant="warning">Not enrolled</Badge>}</div>
              <div><span className="font-medium">KYC:</span> <Badge variant={kycStatus === "APPROVED" ? "success" : kycStatus === "REJECTED" ? "destructive" : "secondary"}>{kycStatus ?? "Not started"}</Badge></div>
              <div><span className="font-medium">Risk:</span> <Badge variant={me.risk?.tier === "LOW" ? "success" : me.risk?.tier === "HIGH" ? "destructive" : "secondary"}>{me.risk?.tier ?? "—"}</Badge>{me.risk?.eddRequired && <span className="text-xs text-slate-400 ml-2">EDD: {me.risk.eddStatus ?? "required"}</span>}</div>
              {me.trust && <div><span className="font-medium">Trust:</span> {me.trust.score}/100 — {Object.entries(me.trust.breakdown).map(([k, v]) => `${k}: +${v}`).join(", ")}</div>}
            </CardContent>
          </Card>

          {/* Revoke */}
          <Card className="border-red-200">
            <CardHeader><CardTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-4 h-4" /> Danger zone</CardTitle><CardDescription>Revoke identity — clears face data.</CardDescription></CardHeader>
            <CardContent><Button variant="destructive" onClick={() => void revokeIdentity()}>Revoke identity</Button></CardContent>
          </Card>
        </div>
      )}

      {/* ── Lookup ── */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Search className="w-4 h-4" /> Lookup user trust</CardTitle><CardDescription>Enter any wallet to view their trust score.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="0x…" value={lookupAddr} onChange={(e) => setLookupAddr(e.target.value)} />
            <Button onClick={() => void doLookup()}>Lookup</Button>
          </div>
          {lookupError && <p className="text-sm text-red-500">{lookupError}</p>}
          {lookupResult && <LookupResultCard data={lookupResult} />}
        </CardContent>
      </Card>

      {subjectId && onChainAtt && (
        <Card>
          <CardHeader><CardTitle>On-chain attestation</CardTitle></CardHeader>
          <CardContent><pre className="text-xs bg-slate-900 text-slate-200 rounded-lg p-3 overflow-auto">{JSON.stringify({ kycLevel: onChainAtt[0], riskTier: onChainAtt[1], verifiedAt: Number(onChainAtt[2]), revoked: onChainAtt[4] }, null, 2)}</pre></CardContent>
        </Card>
      )}

      {error && <Card className="border-red-300"><CardContent className="pt-5 text-sm text-red-600">{error}</CardContent></Card>}
    </div>
  );
}

/* ── Sub-components ── */

function TrustScoreRing({ score, level }: { score: number; level: string }) {
  const r = 34; const circ = 2 * Math.PI * r; const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : score >= 25 ? "#6366f1" : "#94a3b8";
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="5" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 40 40)" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      <text x="40" y="38" textAnchor="middle" style={{ fontSize: "1.1rem", fontWeight: 700, fill: "#0f172a" }}>{score}</text>
      <text x="40" y="50" textAnchor="middle" style={{ fontSize: "0.4rem", fontWeight: 600, fill: color }}>{level}</text>
    </svg>
  );
}

function FaceIdentityCard({ enrolled, faceHash, onChanged }: { enrolled: boolean; faceHash?: string; onChanged: () => void }) {
  const [scannerMode, setScannerMode] = useState<"enroll" | "verify" | null>(null);
  if (scannerMode) return <Card><CardContent className="pt-5"><FaceScanner mode={scannerMode} onComplete={onChanged} onClose={() => setScannerMode(null)} /></CardContent></Card>;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ScanFace className="w-4 h-4" /> Face identity</CardTitle></CardHeader>
      <CardContent className="text-center space-y-3">
        {enrolled ? <Badge variant="success" className="text-sm px-3 py-1">✓ Identity enrolled</Badge> : <Badge variant="warning" className="text-sm px-3 py-1">Not set</Badge>}
        {faceHash && <code className="block text-[0.65rem] text-slate-400 break-all">{faceHash}</code>}
        <div className="flex justify-center gap-2">
          <Button size="sm" onClick={() => setScannerMode("enroll")}>{enrolled ? "Re-set" : "Set identity"}</Button>
          {enrolled && <Button variant="outline" size="sm" onClick={() => setScannerMode("verify")}>Test</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

function KycCard({ applicant, risk, hasApplicant, onStart, onApprove, onReject, country, onCountryChange, eddApproved, onEddChange }: { applicant?: MeData["applicant"]; risk?: MeData["risk"]; hasApplicant: boolean; onStart: () => void; onApprove: () => void; onReject: () => void; country: string; onCountryChange: (v: string) => void; eddApproved: boolean; onEddChange: (v: boolean) => void }) {
  const status = applicant?.status;
  const isApproved = status === "APPROVED"; const isRejected = status === "REJECTED";
  const needsEdd = ["IRN", "PRK", "MMR", "SYR"].includes(country);
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck className="w-4 h-4" /> KYC / CDD / EDD</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          {isApproved && <Badge variant="success">✓ Approved — {risk?.tier ?? "LOW"}{risk?.eddRequired ? ` · EDD ${risk.eddStatus ?? "required"}` : ""}</Badge>}
          {isRejected && <Badge variant="destructive">✗ Rejected</Badge>}
          {!isApproved && !isRejected && hasApplicant && <Badge variant="warning">Pending review</Badge>}
          {!hasApplicant && <Badge variant="secondary">Not started</Badge>}
        </div>
        {!hasApplicant && <Button onClick={onStart}>Start KYC</Button>}
        {hasApplicant && !isApproved && !isRejected && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Country</label>
              <Input value={country} onChange={(e) => onCountryChange(e.target.value.toUpperCase())} maxLength={3} className="w-20" />
            </div>
            {needsEdd && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={eddApproved} onChange={(e) => onEddChange(e.target.checked)} className="rounded" /> EDD cleared
              </label>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={onApprove}>Approve</Button>
              <Button variant="outline" size="sm" onClick={onReject}>Reject</Button>
            </div>
          </div>
        )}
        {(isApproved || isRejected) && <Button variant="outline" size="sm" onClick={onStart}>Restart</Button>}
      </CardContent>
    </Card>
  );
}

function ActivityCard({ sessions, jobs }: { sessions?: MeData["kycSessions"]; jobs?: MeData["recentJobs"] }) {
  const items = [
    ...(sessions ?? []).map(s => ({ type: "KYC", detail: s.status, time: s.createdAt })),
    ...(jobs ?? []).map(j => ({ type: j.kind, detail: `${j.status}${j.txHash ? ` · ${j.txHash.slice(0, 10)}…` : ""}`, time: j.createdAt })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4" /> Activity</CardTitle></CardHeader>
      <CardContent>
        <div className="divide-y divide-slate-100 text-xs">
          {items.map((it, i) => (
            <div key={i} className="flex justify-between py-1.5">
              <span><span className="font-semibold">{it.type}</span> — {it.detail}</span>
              <span className="text-slate-400">{new Date(it.time).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LookupResultCard({ data }: { data: LookupData }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-1 text-sm">
      <div className="flex items-center justify-between">
        <code className="text-xs font-semibold">{data.wallet.slice(0, 8)}…{data.wallet.slice(-6)}</code>
        <TrustScoreRing score={data.trust.score} level={data.trust.level} />
      </div>
      <div>Face: {data.faceEnrolled ? <Badge variant="success">Enrolled</Badge> : <Badge variant="warning">No</Badge>}</div>
      <div>KYC: <Badge variant={data.kyc === "APPROVED" ? "success" : data.kyc === "REJECTED" ? "destructive" : "secondary"}>{data.kyc}</Badge></div>
      {data.riskTier && <div>Risk: <Badge variant={data.riskTier === "LOW" ? "success" : data.riskTier === "HIGH" ? "destructive" : "warning"}>{data.riskTier}</Badge></div>}
      <p className="text-xs text-slate-400">Member since {new Date(data.memberSince).toLocaleDateString()}</p>
    </div>
  );
}
