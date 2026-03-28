import { useState, useEffect, useCallback } from "react";
import { api } from "./api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FaceScanner } from "./components/FaceScanner";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck, ShieldAlert, ScanFace, QrCode, Send,
  AlertTriangle, Phone, UserCheck, Ban, RotateCcw,
  Smartphone, Search, ChevronLeft,
} from "lucide-react";

type User = {
  id: string; phone: string; name: string; verified: boolean;
  faceHash: string | null; faceEnrolledAt: string | null;
  trustScore: number; trustLevel: string;
  isAgent: boolean; revoked: boolean; revokedAt: string | null;
  transactionCount: number;
};

type Screen = "login" | "home" | "send" | "scan" | "revoke" | "face-enroll" | "face-verify" | "demo";

export function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [me, setMe] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("+255712345678");

  const login = async (ph: string) => {
    setError(null);
    const res = await api("/auth/login", { method: "POST", body: JSON.stringify({ phone: ph }) });
    const j = await res.json() as { user?: User; error?: string };
    if (j.user) { setMe(j.user); setScreen("home"); } else setError(j.error ?? "Login failed");
  };

  const refresh = useCallback(async () => {
    if (!me) return;
    const res = await api(`/user/${me.id}`);
    const j = await res.json() as { user?: User };
    if (j.user) setMe(j.user);
  }, [me]);

  if (screen === "login") return <LoginScreen phone={phone} setPhone={setPhone} onLogin={(ph) => void login(ph)} onDemo={() => setScreen("demo")} error={error} />;
  if (!me) return null;
  if (screen === "home") return <HomeScreen me={me} setScreen={setScreen} />;
  if (screen === "send") return <SendMoneyScreen me={me} onBack={() => setScreen("home")} />;
  if (screen === "scan") return <ScanScreen me={me} onBack={() => setScreen("home")} />;
  if (screen === "revoke") return <RevokeScreen me={me} onBack={() => { void refresh(); setScreen("home"); }} />;
  if (screen === "face-enroll") return <FaceEnrollScreen me={me} onDone={() => { void refresh(); setScreen("home"); }} />;
  if (screen === "face-verify") return <FaceVerifyScreen me={me} onDone={() => setScreen("home")} />;
  if (screen === "demo") return <DemoScreen onBack={() => setScreen("login")} onLogin={(ph) => { void login(ph); }} />;
  return null;
}

/* ── LOGIN ── */
function LoginScreen({ phone, setPhone, onLogin, onDemo, error }: { phone: string; setPhone: (v: string) => void; onLogin: (ph: string) => void; onDemo: () => void; error: string | null }) {
  return (
    <Shell>
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-3">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold">Indentix</h1>
        <p className="text-sm text-slate-500">Trusted mobile payments for Tanzania</p>
      </div>
      <Card>
        <CardContent className="pt-5 space-y-3">
          <label className="text-sm font-medium">Phone number</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255…" />
          <Button className="w-full" onClick={() => onLogin(phone)}>
            <Phone className="w-4 h-4 mr-2" /> Sign in
          </Button>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </CardContent>
      </Card>
      <Button variant="outline" className="w-full mt-3" onClick={onDemo}>
        <Smartphone className="w-4 h-4 mr-2" /> Demo mode
      </Button>
    </Shell>
  );
}

/* ── HOME ── */
function HomeScreen({ me, setScreen }: { me: User; setScreen: (s: Screen) => void }) {
  const color = trustColor(me.trustLevel);
  return (
    <Shell>
      <Card className="overflow-hidden">
        <div className={`h-2 ${color === "green" ? "bg-green-500" : color === "amber" ? "bg-amber-500" : color === "red" ? "bg-red-500" : "bg-slate-300"}`} />
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-lg">{me.name}</p>
              <p className="text-xs text-slate-500">{me.phone}</p>
            </div>
            <TrustRing score={me.trustScore} level={me.trustLevel} />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {me.verified && <Badge variant="success">Verified</Badge>}
            {!me.verified && <Badge variant="warning">Unverified</Badge>}
            {me.faceHash && <Badge variant="success">Face ID</Badge>}
            {me.isAgent && <Badge variant="outline">Agent</Badge>}
            {me.revoked && <Badge variant="destructive">REVOKED</Badge>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <ActionCard icon={<Send className="w-5 h-5" />} label="Send Money" desc="Verify before paying" onClick={() => setScreen("send")} />
        <ActionCard icon={<QrCode className="w-5 h-5" />} label="Scan QR" desc="Verify agent/user" onClick={() => setScreen("scan")} />
        <ActionCard icon={<ScanFace className="w-5 h-5" />} label={me.faceHash ? "Verify Face" : "Enroll Face"} desc={me.faceHash ? "Test your identity" : "Set up Face ID"} onClick={() => setScreen(me.faceHash ? "face-verify" : "face-enroll")} />
        <ActionCard icon={<Ban className="w-5 h-5 text-red-500" />} label="Emergency" desc="Lock or recover" className="border-red-200" onClick={() => setScreen("revoke")} />
      </div>

      {me.faceHash && (
        <Card className="mt-4">
          <CardContent className="pt-4">
            <p className="text-xs font-semibold text-slate-500 mb-1">Your identity hash</p>
            <code className="text-[0.6rem] text-slate-400 break-all">{me.faceHash}</code>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardContent className="pt-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">Your QR code</p>
          <div className="flex justify-center">
            <QRCodeSVG value={JSON.stringify({ id: me.id, phone: me.phone, name: me.name, trust: me.trustScore })} size={160} />
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">Show this to verify your identity</p>
        </CardContent>
      </Card>
    </Shell>
  );
}

/* ── SEND MONEY ── */
function SendMoneyScreen({ me: _me, onBack }: { me: User; onBack: () => void }) {
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipient, setRecipient] = useState<User | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [amount, setAmount] = useState("50000");
  const [sent, setSent] = useState(false);

  const lookup = async () => {
    setRecipient(null); setLookupDone(false);
    const res = await api(`/lookup/phone/${encodeURIComponent(recipientPhone)}`);
    const j = await res.json() as { user?: User };
    setRecipient(j.user ?? null);
    setLookupDone(true);
  };

  const rColor = recipient ? trustColor(recipient.trustLevel) : "";
  const isSafe = recipient && recipient.trustScore >= 50 && !recipient.revoked;

  return (
    <Shell>
      <BackButton onClick={onBack} />
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Send className="w-5 h-5" /> Send Money</h2>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <label className="text-sm font-medium">Recipient phone</label>
          <div className="flex gap-2">
            <Input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="+255…" />
            <Button onClick={() => void lookup()}>Check</Button>
          </div>

          {lookupDone && !recipient && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 inline mr-1" />
              <strong>Unknown user</strong> — not registered on Indentix. Proceed with caution.
            </div>
          )}

          {recipient && (
            <div className={`rounded-lg border p-3 ${rColor === "red" ? "border-red-300 bg-red-50" : rColor === "green" ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{recipient.name}</p>
                  <p className="text-xs text-slate-500">{recipient.phone}</p>
                </div>
                <TrustRing score={recipient.trustScore} level={recipient.trustLevel} size={60} />
              </div>
              <div className="flex gap-1.5 mt-2">
                {recipient.verified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Unverified</Badge>}
                {recipient.faceHash && <Badge variant="success">Face ID</Badge>}
                {recipient.revoked && <Badge variant="destructive">REVOKED</Badge>}
                {recipient.trustLevel === "SCAMMER" && <Badge variant="destructive">⚠ SCAMMER</Badge>}
              </div>
              {!isSafe && <p className="text-xs text-red-600 mt-2 font-semibold">⚠ Warning: Low trust score or revoked account. Do not send money.</p>}
            </div>
          )}

          {isSafe && !sent && (
            <>
              <label className="text-sm font-medium">Amount (TZS)</label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Button className="w-full" onClick={() => setSent(true)}>
                <UserCheck className="w-4 h-4 mr-2" /> Confirm & Send {Number(amount).toLocaleString()} TZS
              </Button>
            </>
          )}

          {sent && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
              <ShieldCheck className="w-8 h-8 text-green-500 mx-auto" />
              <p className="font-bold mt-2">Payment sent</p>
              <p className="text-xs text-slate-500">Verified recipient: {recipient?.name}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-3">
        <CardContent className="pt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500">Verify a payment confirmation</p>
          <p className="text-xs text-slate-400">Got a screenshot? Check if the transaction is real.</p>
          <Button variant="outline" size="sm" onClick={async () => {
            const res = await api("/payment/verify", { method: "POST", body: JSON.stringify({ senderPhone: recipientPhone || "+255700000000" }) });
            const j = await res.json() as { verified: boolean; warning?: string };
            alert(j.verified ? "✓ Payment verified as REAL" : `⚠ ${j.warning ?? "FAKE PAYMENT — not found in network"}`);
          }}>
            <Search className="w-4 h-4 mr-1" /> Verify payment
          </Button>
        </CardContent>
      </Card>
    </Shell>
  );
}

/* ── SCAN QR ── */
function ScanScreen({ me: _me, onBack }: { me: User; onBack: () => void }) {
  const [scannedId, setScannedId] = useState("");
  const [result, setResult] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  const check = async () => {
    setResult(null); setChecked(false);
    const res = await api(`/user/${scannedId}`);
    const j = await res.json() as { user?: User };
    setResult(j.user ?? null);
    setChecked(true);
  };

  return (
    <Shell>
      <BackButton onClick={onBack} />
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><QrCode className="w-5 h-5" /> Scan & Verify</h2>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm text-slate-500">Enter the user/agent ID from their QR code:</p>
          <div className="flex gap-2">
            <Input value={scannedId} onChange={(e) => setScannedId(e.target.value)} placeholder="user_mama_anna" />
            <Button onClick={() => void check()}>Verify</Button>
          </div>

          {/* Demo quick-scan buttons */}
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" onClick={() => { setScannedId("user_real_agent"); }}>Real Agent</Button>
            <Button variant="outline" size="sm" onClick={() => { setScannedId("user_fake_agent"); }}>Fake Agent</Button>
            <Button variant="outline" size="sm" onClick={() => { setScannedId("user_scammer"); }}>Scammer</Button>
            <Button variant="outline" size="sm" onClick={() => { setScannedId("user_mama_anna"); }}>Mama Anna</Button>
          </div>
        </CardContent>
      </Card>

      {checked && !result && (
        <Card className="mt-3 border-red-300">
          <CardContent className="pt-4 text-center">
            <ShieldAlert className="w-8 h-8 text-red-500 mx-auto" />
            <p className="font-bold text-red-600 mt-2">NOT FOUND</p>
            <p className="text-xs text-slate-500">This ID is not registered. Do not trust this person.</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className={`mt-3 ${result.trustScore < 50 || result.revoked ? "border-red-300" : "border-green-200"}`}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">{result.name}</p>
                <p className="text-xs text-slate-500">{result.phone}</p>
              </div>
              <TrustRing score={result.trustScore} level={result.trustLevel} size={60} />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {result.verified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Unverified</Badge>}
              {result.faceHash && <Badge variant="success">Face ID</Badge>}
              {result.isAgent && result.verified && <Badge variant="success">Licensed Agent</Badge>}
              {result.isAgent && !result.verified && <Badge variant="destructive">⚠ UNVERIFIED AGENT</Badge>}
              {result.revoked && <Badge variant="destructive">REVOKED</Badge>}
              {result.trustLevel === "SCAMMER" && <Badge variant="destructive">⚠ KNOWN SCAMMER</Badge>}
            </div>
            {(result.trustScore < 50 || result.revoked || result.trustLevel === "SCAMMER") && (
              <div className="mt-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                ⚠ Do NOT transact with this {result.isAgent ? "agent" : "user"}. Low trust / flagged.
              </div>
            )}
            {result.trustScore >= 50 && !result.revoked && (
              <div className="mt-3 p-2 rounded bg-green-50 border border-green-200 text-xs text-green-700 font-semibold">
                ✓ This {result.isAgent ? "agent" : "user"} is trusted. Safe to transact.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </Shell>
  );
}

/* ── REVOKE / RECOVER ── */
function RevokeScreen({ me, onBack }: { me: User; onBack: () => void }) {
  const [done, setDone] = useState<string | null>(null);
  const revoke = async () => {
    const res = await api("/identity/revoke", { method: "POST", body: JSON.stringify({ userId: me.id }) });
    const j = await res.json() as { message?: string };
    setDone(j.message ?? "Revoked");
  };
  const recover = async () => {
    const res = await api("/identity/recover", { method: "POST", body: JSON.stringify({ userId: me.id }) });
    const j = await res.json() as { message?: string };
    setDone(j.message ?? "Recovered");
  };

  return (
    <Shell>
      <BackButton onClick={onBack} />
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Ban className="w-5 h-5 text-red-500" /> Emergency</h2>

      {!me.revoked ? (
        <Card className="border-red-200">
          <CardContent className="pt-5 space-y-3">
            <p className="text-sm">Phone stolen? SIM swapped? Lock your identity immediately.</p>
            <Button variant="destructive" className="w-full" onClick={() => void revoke()}>
              <Ban className="w-4 h-4 mr-2" /> Lock my identity NOW
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-200">
          <CardContent className="pt-5 space-y-3">
            <div className="text-center">
              <Ban className="w-8 h-8 text-red-500 mx-auto" />
              <p className="font-bold text-red-600 mt-2">Account is LOCKED</p>
              <p className="text-xs text-slate-500 mt-1">Locked at {me.revokedAt ? new Date(me.revokedAt).toLocaleString() : "—"}</p>
            </div>
            <Button className="w-full" onClick={() => void recover()}>
              <RotateCcw className="w-4 h-4 mr-2" /> Recover my identity
            </Button>
            <p className="text-xs text-slate-400">You'll need to re-enroll your face after recovery.</p>
          </CardContent>
        </Card>
      )}

      {done && (
        <Card className="mt-3">
          <CardContent className="pt-4 text-center">
            <ShieldCheck className="w-6 h-6 text-green-500 mx-auto" />
            <p className="text-sm mt-2">{done}</p>
          </CardContent>
        </Card>
      )}
    </Shell>
  );
}

/* ── FACE ENROLL ── */
function FaceEnrollScreen({ me, onDone }: { me: User; onDone: () => void }) {
  return (
    <Shell>
      <FaceScanner mode="enroll" userId={me.id} onComplete={onDone} onClose={onDone} />
    </Shell>
  );
}

/* ── FACE VERIFY ── */
function FaceVerifyScreen({ me, onDone }: { me: User; onDone: () => void }) {
  return (
    <Shell>
      <FaceScanner mode="verify" userId={me.id} onComplete={onDone} onClose={onDone} />
    </Shell>
  );
}

/* ── DEMO MODE ── */
function DemoScreen({ onBack, onLogin }: { onBack: () => void; onLogin: (ph: string) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => { void (async () => { const res = await api("/demo/users"); const j = await res.json() as { users: User[] }; setUsers(j.users ?? []); })(); }, []);

  return (
    <Shell>
      <BackButton onClick={onBack} />
      <h2 className="text-lg font-bold mb-3">Demo mode</h2>
      <p className="text-sm text-slate-500 mb-3">Pre-loaded Tanzania mobile payment users. Tap to login as any of them.</p>
      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id} className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => onLogin(u.phone)}>
            <CardContent className="pt-3 pb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{u.name}</p>
                <p className="text-xs text-slate-400">{u.phone} {u.isAgent ? "· Agent" : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={u.trustScore >= 50 ? "success" : u.trustLevel === "SCAMMER" ? "destructive" : "warning"}>{u.trustLevel}</Badge>
                <span className="text-xs font-bold">{u.trustScore}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Shell>
  );
}

/* ── Shared components ── */

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="max-w-sm mx-auto px-4 py-6 min-h-screen bg-slate-50">{children}</div>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="flex items-center gap-1 text-sm text-slate-500 mb-3 hover:text-slate-700"><ChevronLeft className="w-4 h-4" /> Back</button>;
}

function ActionCard({ icon, label, desc, className, onClick }: { icon: React.ReactNode; label: string; desc: string; className?: string; onClick: () => void }) {
  return (
    <Card className={`cursor-pointer hover:bg-slate-50 transition-colors ${className ?? ""}`} onClick={onClick}>
      <CardContent className="pt-4 pb-3 text-center">
        <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">{icon}</div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[0.65rem] text-slate-400">{desc}</p>
      </CardContent>
    </Card>
  );
}

function TrustRing({ score, level, size = 70 }: { score: number; level: string; size?: number }) {
  const r = size * 0.38; const circ = 2 * Math.PI * r; const offset = circ - (score / 100) * circ;
  const c = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : score >= 25 ? "#6366f1" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth="4" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.5s" }} />
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" style={{ fontSize: size * 0.22, fontWeight: 700, fill: "#0f172a" }}>{score}</text>
      <text x={size / 2} y={size / 2 + size * 0.12} textAnchor="middle" style={{ fontSize: size * 0.1, fontWeight: 600, fill: c }}>{level}</text>
    </svg>
  );
}

function trustColor(level: string) {
  if (level === "TRUSTED") return "green";
  if (level === "VERIFIED") return "green";
  if (level === "BASIC") return "amber";
  return "red";
}
