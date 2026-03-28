import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FaceScanner } from "./components/FaceScanner";
import { IndentixLogo } from "./components/IndentixLogo";
import { QRCodeSVG } from "qrcode.react";
import { QrScanner } from "./components/QrScanner";
import {
  ShieldCheck, ShieldAlert, ScanFace, QrCode, Send,
  AlertTriangle, Phone, UserCheck, Ban, RotateCcw,
  Smartphone, Search, ChevronLeft, LogOut, Home,
  Wallet, ArrowUpRight, ArrowDownLeft, CreditCard, Camera,
} from "lucide-react";

type Tx = {
  id: string; from: string; to: string; amount: number;
  currency: string; status: "confirmed" | "pending" | "fake"; timestamp: string;
};

type User = {
  id: string; phone: string; name: string; passwordSet?: boolean; verified: boolean;
  faceHash: string | null; faceEnrolledAt: string | null;
  govIdUploaded: boolean; govIdUploadedAt: string | null;
  onboarded: boolean; balance: number;
  trustScore: number; trustLevel: string;
  isAgent: boolean; revoked: boolean; revokedAt: string | null;
  createdAt: string; transactionCount: number; transactions: Tx[];
};

type Screen = "login" | "face-login" | "onboarding" | "home" | "send" | "scan" | "revoke" | "face-enroll" | "face-verify" | "demo" | "public-verify" | "wallet" | "activity";

const POST_LOGIN_SEND_KEY = "indentix_post_login_send_user_id";

function parseVerifyPath(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/^\/verify\/([a-zA-Z0-9_]+)\/?$/);
  return m ? m[1] : null;
}

export function App() {
  const [screen, setScreen] = useState<Screen>(() => (parseVerifyPath() ? "public-verify" : "login"));
  const [me, setMe] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("+14703803242");
  const [publicVerifyId, setPublicVerifyId] = useState<string | null>(() => parseVerifyPath());
  const [sendPrefillUserId, setSendPrefillUserId] = useState<string | null>(null);
  const [pendingLoginUserId, setPendingLoginUserId] = useState<string | null>(null);
  const [pendingLoginUserName, setPendingLoginUserName] = useState<string | null>(null);

  const clearSendPrefill = useCallback(() => setSendPrefillUserId(null), []);

  const login = async (ph: string, password?: string) => {
    setError(null);
    const res = await api("/auth/login", { method: "POST", body: JSON.stringify({ phone: ph, password: password ?? "" }) });
    const j = await res.json() as { user?: User; requireFace?: boolean; userId?: string; userName?: string; error?: string };
    if (!res.ok) {
      setError(j.error ?? "Login failed");
      return;
    }
    if (j.requireFace && j.userId) {
      setPendingLoginUserId(j.userId);
      setPendingLoginUserName(j.userName ?? null);
      setScreen("face-login");
    } else if (j.user) {
      setMe(j.user);
      if (j.user.onboarded) {
        let pending: string | null = null;
        try { pending = sessionStorage.getItem(POST_LOGIN_SEND_KEY); } catch { /* */ }
        if (pending) {
          try { sessionStorage.removeItem(POST_LOGIN_SEND_KEY); } catch { /* */ }
          setSendPrefillUserId(pending);
          setScreen("send");
        } else setScreen("home");
      } else setScreen("onboarding");
    } else {
      setError(j.error ?? "Login failed");
    }
  };

  const register = async (name: string, ph: string, password: string) => {
    setError(null);
    const res = await api("/auth/register", { method: "POST", body: JSON.stringify({ phone: ph, name, password }) });
    const j = await res.json() as { user?: User; error?: string };
    if (!res.ok) {
      setError(j.error ?? "Could not create account");
      return;
    }
    if (j.user) {
      setMe(j.user);
      if (j.user.onboarded) {
        let pending: string | null = null;
        try { pending = sessionStorage.getItem(POST_LOGIN_SEND_KEY); } catch { /* */ }
        if (pending) {
          try { sessionStorage.removeItem(POST_LOGIN_SEND_KEY); } catch { /* */ }
          setSendPrefillUserId(pending);
          setScreen("send");
        } else setScreen("home");
      } else setScreen("onboarding");
    }
  };

  const verifyFaceLogin = async (embedding: number[]) => {
    if (!pendingLoginUserId) return;
    setError(null);
    const res = await api("/auth/verify-face", { method: "POST", body: JSON.stringify({ userId: pendingLoginUserId, embedding }) });
    const j = await res.json() as { user?: User; verified?: boolean; error?: string; distance?: number };
    if (!res.ok) {
      setError(j.error ?? `Face mismatch (distance: ${j.distance ?? "?"}). Try again.`);
      return;
    }
    if (j.user && j.verified) {
      setMe(j.user);
      setPendingLoginUserId(null);
      setPendingLoginUserName(null);
      if (j.user.onboarded) {
        let pending: string | null = null;
        try { pending = sessionStorage.getItem(POST_LOGIN_SEND_KEY); } catch { /* */ }
        if (pending) {
          try { sessionStorage.removeItem(POST_LOGIN_SEND_KEY); } catch { /* */ }
          setSendPrefillUserId(pending);
          setScreen("send");
        } else setScreen("home");
      } else setScreen("onboarding");
    } else {
      setError(j.error ?? `Face mismatch (distance: ${j.distance ?? "?"}). Try again.`);
    }
  };

  const refresh = useCallback(async () => {
    if (!me) return;
    const res = await api(`/user/${me.id}`);
    const j = await res.json() as { user?: User };
    if (j.user) setMe(j.user);
  }, [me]);

  const logout = () => { setMe(null); setScreen("login"); };

  if (screen === "public-verify" && publicVerifyId) {
    return (
      <PublicVerifyScreen
        userId={publicVerifyId}
        me={me}
        onBack={() => {
          setPublicVerifyId(null);
          setScreen(me ? "home" : "login");
          window.history.replaceState({}, "", "/");
        }}
        onSignInToSend={(uid) => {
          try { sessionStorage.setItem(POST_LOGIN_SEND_KEY, uid); } catch { /* */ }
          setScreen("login");
        }}
        onSendMoney={(uid) => {
          setSendPrefillUserId(uid);
          setScreen("send");
        }}
      />
    );
  }
  if (screen === "login") return <LoginScreen phone={phone} setPhone={setPhone} onLogin={(ph, pw) => void login(ph, pw)} onRegister={(name, ph, pw) => void register(name, ph, pw)} onClearError={() => setError(null)} onDemo={() => setScreen("demo")} error={error} />;
  if (screen === "face-login") return <FaceLoginScreen userId={pendingLoginUserId!} userName={pendingLoginUserName} onVerify={(emb) => void verifyFaceLogin(emb)} onBack={() => { setPendingLoginUserId(null); setScreen("login"); }} error={error} />;
  if (!me) return null;
  if (screen === "onboarding") {
    return (
      <OnboardingScreen
        me={me}
        onDone={() => {
          void refresh();
          let pending: string | null = null;
          try { pending = sessionStorage.getItem(POST_LOGIN_SEND_KEY); } catch { /* */ }
          if (pending) {
            try { sessionStorage.removeItem(POST_LOGIN_SEND_KEY); } catch { /* */ }
            setSendPrefillUserId(pending);
            setScreen("send");
          } else setScreen("home");
        }}
      />
    );
  }
  if (screen === "send") {
    return (
      <SendMoneyScreen
        me={me}
        initialRecipientUserId={sendPrefillUserId}
        onConsumedPrefill={clearSendPrefill}
        onBack={() => {
          clearSendPrefill();
          setScreen("home");
        }}
      />
    );
  }
  if (screen === "scan") return <ScanScreen me={me} onBack={() => setScreen("home")} />;
  if (screen === "revoke") return <RevokeScreen me={me} onBack={() => { void refresh(); setScreen("home"); }} />;
  if (screen === "face-enroll") return <FaceEnrollScreen me={me} onDone={() => { void refresh(); setScreen("home"); }} />;
  if (screen === "face-verify") return <FaceVerifyScreen me={me} onDone={() => setScreen("home")} />;
  if (screen === "demo") return <DemoScreen onBack={() => setScreen("login")} onLogin={(ph) => { void login(ph, ""); }} />;

  /* Home / Wallet / Activity share the same bottom nav */
  return (
    <div className="max-w-sm mx-auto min-h-screen bg-white dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100">
      <div className="flex-1 overflow-auto pb-20">
        {screen === "home" && <HomeTab me={me} setScreen={setScreen} onLogout={logout} />}
        {screen === "wallet" && <WalletTab me={me} />}
        {screen === "activity" && <ActivityTab me={me} />}
      </div>
      <BottomNav active={screen} onNav={setScreen} />
    </div>
  );
}

/* ══════════════════════════════════════════════
   HOME TAB — PayPal style
   ══════════════════════════════════════════════ */
function HomeTab({ me, setScreen, onLogout }: { me: User; setScreen: (s: Screen) => void; onLogout: () => void }) {
  return (
    <>
      {/* Dark header */}
      <div className="bg-[#003087] text-white px-5 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-white/15 flex items-center justify-center p-1">
              <IndentixLogo className="h-7 w-7" />
            </div>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
              {me.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div>
              <p className="font-semibold text-sm">{me.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <TrustDot level={me.trustLevel} />
                <span className="text-xs text-white/70">{me.trustLevel} · {me.trustScore}</span>
              </div>
            </div>
          </div>
          <button onClick={onLogout} className="text-white/50 hover:text-white/80"><LogOut className="w-4 h-4" /></button>
        </div>

        <p className="text-xs text-white/60 uppercase tracking-wider">Indentix balance</p>
        <p className="text-4xl font-bold mt-1">{me.balance.toLocaleString()} <span className="text-lg font-normal text-white/50">TZS</span></p>
        <p className="text-xs text-white/40 mt-1">≈ ${(me.balance / 2500).toFixed(2)} USD</p>

        {/* Send / Request / Scan */}
        <div className="flex justify-around mt-6">
          <NavBtn icon={<ArrowUpRight className="w-5 h-5" />} label="Send" onClick={() => setScreen("send")} />
          <NavBtn icon={<QrCode className="w-5 h-5" />} label="Scan" onClick={() => setScreen("scan")} />
          <NavBtn icon={<ScanFace className="w-5 h-5" />} label={me.faceHash ? "Verify" : "Face ID"} onClick={() => setScreen(me.faceHash ? "face-verify" : "face-enroll")} />
          <NavBtn icon={<Ban className="w-5 h-5" />} label="Lock" onClick={() => setScreen("revoke")} />
        </div>
      </div>

      <div className="px-5 mt-5 space-y-3">
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          {me.verified && <Badge variant="success">✓ Verified</Badge>}
          {!me.verified && <Badge variant="warning">Unverified</Badge>}
          {me.faceHash && <Badge variant="success">Face ID</Badge>}
          {me.govIdUploaded && <Badge variant="success">Gov ID</Badge>}
          {me.isAgent && <Badge variant="outline">Agent</Badge>}
          {me.revoked && <Badge variant="destructive">REVOKED</Badge>}
        </div>

        {/* Recent activity */}
        <div className="mt-2">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Recent activity</p>
          {me.transactions.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No transactions yet.</p>}
          {me.transactions.slice(0, 4).map((tx) => {
            const isSent = tx.from === me.phone;
            return (
              <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isSent ? "bg-red-50 dark:bg-red-950/50" : "bg-green-50 dark:bg-green-950/50"}`}>
                  {isSent ? <ArrowUpRight className="w-4 h-4 text-red-500" /> : <ArrowDownLeft className="w-4 h-4 text-green-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{isSent ? `To ${tx.to}` : `From ${tx.from}`}</p>
                  <p className="text-[0.65rem] text-slate-400 dark:text-slate-500">{new Date(tx.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {tx.status === "fake" ? "⚠ Flagged" : tx.status}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${isSent ? "text-slate-900 dark:text-slate-100" : "text-green-600 dark:text-green-400"}`}>
                    {isSent ? "-" : "+"}{tx.amount.toLocaleString()}
                  </p>
                  <p className="text-[0.6rem] text-slate-400 dark:text-slate-500">{tx.currency}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* QR */}
        <Card className="mt-2">
          <CardContent className="pt-4 text-center">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Your QR code</p>
            <QRCodeSVG value={`${window.location.origin}/verify/${me.id}`} size={120} className="mx-auto rounded-lg bg-white p-1" />
            <p className="text-[0.6rem] text-slate-300 dark:text-slate-500 mt-2 break-all">{window.location.origin}/verify/{me.id}</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/* ── Wallet Tab ── */
function WalletTab({ me }: { me: User }) {
  return (
    <div className="px-5 pt-6">
      <h2 className="text-lg font-bold mb-4">Wallet</h2>
      <Card className="bg-gradient-to-br from-[#003087] to-[#001e5a] text-white">
        <CardContent className="pt-5 pb-5">
          <p className="text-xs text-white/60">Indentix balance</p>
          <p className="text-3xl font-bold mt-1">{me.balance.toLocaleString()} TZS</p>
          <p className="text-xs text-white/40 mt-1">≈ ${(me.balance / 2500).toFixed(2)} USD</p>
        </CardContent>
      </Card>

      <div className="mt-5 space-y-3">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Account details</p>
        <Row label="Phone" value={me.phone} />
        <Row label="Trust score" value={`${me.trustScore}/100 (${me.trustLevel})`} />
        <Row label="Face ID" value={me.faceHash ? "Enrolled" : "Not set"} color={me.faceHash ? "text-green-600" : "text-amber-500"} />
        <Row label="Gov ID" value={me.govIdUploaded ? "Uploaded" : "Not uploaded"} color={me.govIdUploaded ? "text-green-600" : "text-amber-500"} />
        <Row label="Status" value={me.verified ? "Verified" : me.revoked ? "Revoked" : "Unverified"} color={me.verified ? "text-green-600" : "text-red-500"} />
        <Row label="Member since" value={new Date(me.createdAt ?? "").toLocaleDateString()} />
        {me.faceHash && (
          <div className="pt-2">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Identity hash</p>
            <code className="text-[0.6rem] text-slate-400 dark:text-slate-500 break-all">{me.faceHash}</code>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-sm font-medium ${color ?? "text-slate-900 dark:text-slate-100"}`}>{value}</span>
    </div>
  );
}

/* ── Activity Tab ── */
function ActivityTab({ me }: { me: User }) {
  return (
    <div className="px-5 pt-6">
      <h2 className="text-lg font-bold mb-4">Activity</h2>
      {me.transactions.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No transactions yet.</p>}
      {me.transactions.map((tx) => {
        const isSent = tx.from === me.phone;
        return (
          <div key={tx.id} className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSent ? "bg-red-50 dark:bg-red-950/50" : "bg-green-50 dark:bg-green-950/50"}`}>
              {isSent ? <ArrowUpRight className="w-4 h-4 text-red-500" /> : <ArrowDownLeft className="w-4 h-4 text-green-500" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{isSent ? `Sent to ${tx.to}` : `Received from ${tx.from}`}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(tx.timestamp).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {new Date(tx.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${isSent ? "text-slate-900 dark:text-slate-100" : "text-green-600 dark:text-green-400"}`}>
                {isSent ? "-" : "+"}{tx.amount.toLocaleString()} {tx.currency}
              </p>
              <Badge variant={tx.status === "confirmed" ? "success" : tx.status === "fake" ? "destructive" : "warning"} className="text-[0.55rem] mt-0.5">{tx.status}</Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════
   BOTTOM NAV — PayPal style
   ══════════════════════════════════════════════ */
function BottomNav({ active, onNav }: { active: Screen; onNav: (s: Screen) => void }) {
  const items: { screen: Screen; icon: React.ReactNode; label: string }[] = [
    { screen: "home", icon: <Home className="w-5 h-5" />, label: "Home" },
    { screen: "send", icon: <Send className="w-5 h-5" />, label: "Payments" },
    { screen: "wallet", icon: <Wallet className="w-5 h-5" />, label: "Wallet" },
    { screen: "activity", icon: <CreditCard className="w-5 h-5" />, label: "Activity" },
  ];
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-around py-2 z-50">
      {items.map((it) => {
        const isActive = active === it.screen;
        return (
          <button key={it.screen} onClick={() => onNav(it.screen)} className={`flex flex-col items-center gap-0.5 py-1 px-3 ${isActive ? "text-[#003087] dark:text-sky-400" : "text-slate-400 dark:text-slate-500"}`}>
            {it.icon}
            <span className="text-[0.6rem] font-semibold">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function NavBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">{icon}</div>
      <span className="text-[0.65rem] text-white/80">{label}</span>
    </button>
  );
}

function TrustDot({ level }: { level: string }) {
  const c = level === "TRUSTED" || level === "VERIFIED" ? "bg-green-400" : level === "BASIC" ? "bg-amber-400" : "bg-red-400";
  return <span className={`w-2 h-2 rounded-full ${c}`} />;
}

/* ══════════════════════════════════════════════
   OTHER SCREENS (unchanged logic, PayPal styling)
   ══════════════════════════════════════════════ */

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="max-w-sm mx-auto px-5 py-6 min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">{children}</div>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="flex items-center gap-1 text-sm text-[#003087] dark:text-sky-400 mb-4 hover:underline"><ChevronLeft className="w-4 h-4" /> Back</button>;
}

/* ── LOGIN ── */
function LoginScreen({ phone, setPhone, onLogin, onRegister, onClearError, onDemo, error }: {
  phone: string; setPhone: (v: string) => void;
  onLogin: (ph: string, password?: string) => void;
  onRegister: (name: string, ph: string, password: string) => void;
  onClearError: () => void;
  onDemo: () => void; error: string | null;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const submit = () => {
    if (mode === "signup") {
      if (!name.trim()) return;
      if (password.length < 8) return;
      if (password !== confirm) return;
      onRegister(name.trim(), phone, password);
      return;
    }
    onLogin(phone, password);
  };

  return (
    <Shell>
      <div className="text-center mb-8 mt-8">
        <div className="mx-auto mb-4 flex justify-center">
          <IndentixLogo className="h-20 w-20" />
        </div>
        <h1 className="text-2xl font-bold text-[#003087] dark:text-sky-400">Indentix</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Trusted mobile payments for Tanzania</p>
      </div>
      <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-4">
        <button type="button" className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === "signin" ? "bg-white dark:bg-slate-950 text-[#003087] dark:text-sky-400 shadow-sm" : "text-slate-500 dark:text-slate-400"}`} onClick={() => { setMode("signin"); onClearError(); }}>Sign in</button>
        <button type="button" className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === "signup" ? "bg-white dark:bg-slate-950 text-[#003087] dark:text-sky-400 shadow-sm" : "text-slate-500 dark:text-slate-400"}`} onClick={() => { setMode("signup"); onClearError(); }}>Sign up</button>
      </div>
      <div className="space-y-4">
        {mode === "signup" && (
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-slate-300">Full name</label>
            <Input className="mt-1.5 h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amina Juma" autoComplete="name" />
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-slate-300">Phone number</label>
          <Input className="mt-1.5 h-12 text-base" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255…" type="tel" autoComplete="tel" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-slate-300">Password</label>
          <Input className="mt-1.5 h-12 text-base" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signin" ? "Demo accounts: leave blank" : "At least 8 characters"} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          {mode === "signin" && (
            <p className="text-[0.65rem] text-slate-400 mt-1.5 leading-snug">If you set up Face ID on this account, you will scan your face next so we can match it to the one you enrolled.</p>
          )}
        </div>
        {mode === "signup" && (
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-slate-300">Confirm password</label>
            <Input className="mt-1.5 h-12 text-base" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" type="password" autoComplete="new-password" />
          </div>
        )}
        <Button
          className="w-full h-12 text-base bg-[#003087] hover:bg-[#002060]"
          onClick={submit}
          disabled={mode === "signup" && (!name.trim() || password.length < 8 || password !== confirm)}
        >
          <Phone className="w-4 h-4 mr-2" /> {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
        {mode === "signup" && password.length > 0 && password.length < 8 && <p className="text-xs text-amber-600 text-center">Use at least 8 characters.</p>}
        {mode === "signup" && confirm.length > 0 && password !== confirm && <p className="text-xs text-red-500 text-center">Passwords do not match.</p>}
        {error && <p className="text-xs text-red-500 text-center">{error}</p>}
        <div className="relative flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <Button variant="outline" className="w-full h-11" onClick={onDemo}>
          <Smartphone className="w-4 h-4 mr-2" /> Demo mode
        </Button>
      </div>
    </Shell>
  );
}

/* ── SEND MONEY ── */
function SendMoneyScreen({
  me: _me,
  onBack,
  initialRecipientUserId,
  onConsumedPrefill,
}: {
  me: User;
  onBack: () => void;
  initialRecipientUserId?: string | null;
  onConsumedPrefill?: () => void;
}) {
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipient, setRecipient] = useState<User | null>(null);
  const [lookupDone, setLookupDone] = useState(false);
  const [amount, setAmount] = useState("50000");
  const [sent, setSent] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ verified: boolean; warning?: string } | null>(null);

  useEffect(() => {
    if (!initialRecipientUserId) return;
    let cancelled = false;
    void (async () => {
      const res = await api(`/user/${initialRecipientUserId}`);
      const j = await res.json() as { user?: User };
      if (cancelled) return;
      if (j.user) {
        setRecipientPhone(j.user.phone);
        setRecipient(j.user);
        setLookupDone(true);
      }
      onConsumedPrefill?.();
    })();
    return () => { cancelled = true; };
  }, [initialRecipientUserId, onConsumedPrefill]);

  const lookup = async () => {
    setRecipient(null); setLookupDone(false);
    const res = await api(`/lookup/phone/${encodeURIComponent(recipientPhone)}`);
    const j = await res.json() as { user?: User };
    setRecipient(j.user ?? null);
    setLookupDone(true);
  };

  const isSafe = recipient && recipient.trustScore >= 50 && !recipient.revoked;

  return (
    <Shell>
      <BackButton onClick={onBack} />
      <h2 className="text-xl font-bold text-[#003087] dark:text-sky-400 mb-1">Send Money</h2>
      <p className="text-sm text-slate-500 mb-4">Verify the recipient before sending.</p>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Recipient phone</label>
          <div className="flex gap-2 mt-1.5">
            <Input className="h-11" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="+255…" />
            <Button className="h-11 bg-[#003087] hover:bg-[#002060]" onClick={() => void lookup()}>Check</Button>
          </div>
        </div>

        {lookupDone && !recipient && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div><p className="text-sm font-semibold text-amber-700">Unknown user</p><p className="text-xs text-amber-600">Not registered on Indentix. Proceed with caution.</p></div>
          </div>
        )}

        {recipient && (
          <div className={`rounded-xl border-2 p-4 ${isSafe ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">{recipient.name}</p>
                <p className="text-xs text-slate-500">{recipient.phone}</p>
              </div>
              <TrustRing score={recipient.trustScore} level={recipient.trustLevel} size={55} />
            </div>
            <div className="flex gap-1.5 mt-2">
              {recipient.verified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Unverified</Badge>}
              {recipient.faceHash && <Badge variant="success">Face ID</Badge>}
              {recipient.revoked && <Badge variant="destructive">REVOKED</Badge>}
              {recipient.trustLevel === "SCAMMER" && <Badge variant="destructive">⚠ SCAMMER</Badge>}
            </div>
            {!isSafe && <p className="text-xs text-red-700 mt-2 font-semibold">⚠ Warning: Do not send money to this user.</p>}
          </div>
        )}

        {isSafe && !sent && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Amount (TZS)</label>
            <Input className="h-12 text-2xl font-bold text-center" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button className="w-full h-12 bg-[#003087] hover:bg-[#002060]" onClick={() => setSent(true)}>
              <UserCheck className="w-4 h-4 mr-2" /> Send {Number(amount).toLocaleString()} TZS
            </Button>
          </div>
        )}

        {sent && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center">
            <ShieldCheck className="w-10 h-10 text-green-500 mx-auto" />
            <p className="font-bold mt-3 text-lg">Payment sent!</p>
            <p className="text-sm text-slate-500">To {recipient?.name}</p>
          </div>
        )}

        {/* Verify payment section */}
        <div className="pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 mb-2">Got a payment screenshot?</p>
          <Button variant="outline" size="sm" onClick={async () => {
            setPaymentResult(null);
            const res = await api("/payment/verify", { method: "POST", body: JSON.stringify({ senderPhone: recipientPhone || "+255700000000" }) });
            setPaymentResult(await res.json() as { verified: boolean; warning?: string });
          }}>
            <Search className="w-4 h-4 mr-1" /> Verify payment
          </Button>
          {paymentResult && (
            <div className={`rounded-xl p-3 mt-2 ${paymentResult.verified ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <p className={`text-sm font-semibold ${paymentResult.verified ? "text-green-700" : "text-red-700"}`}>
                {paymentResult.verified ? "✓ Payment verified as REAL" : `⚠ ${paymentResult.warning ?? "FAKE"}`}
              </p>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ── SCAN QR ── */
function ScanScreen({ me: _me, onBack }: { me: User; onBack: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [scannedId, setScannedId] = useState("");
  const [result, setResult] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [sendAmount, setSendAmount] = useState("50000");
  const [sent, setSent] = useState(false);

  const parseQrData = (raw: string): string => {
    const m = raw.match(/\/verify\/([a-zA-Z0-9_]+)/);
    if (m) return m[1];
    try { const j = JSON.parse(raw); if (j.id) return j.id; } catch { /* */ }
    if (raw.startsWith("user_")) return raw;
    return raw;
  };

  const lookupId = async (uid: string) => {
    if (!uid.trim()) return;
    setResult(null); setChecked(false); setSent(false); setScannedId(uid);
    const res = await api(`/user/${uid}`);
    const j = await res.json() as { user?: User };
    setResult(j.user ?? null);
    setChecked(true);
  };

  const handleScan = useCallback((data: string) => {
    setScanning(false);
    const uid = parseQrData(data);
    void lookupId(uid);
  }, []);

  const isSafe = result && result.trustScore >= 50 && !result.revoked;

  return (
    <Shell>
      <BackButton onClick={onBack} />
      <h2 className="text-xl font-bold text-[#003087] dark:text-sky-400 mb-1">Scan & Pay</h2>
      <p className="text-sm text-slate-500 mb-4">Scan a QR code to verify identity and send money.</p>

      {scanning ? (
        <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />
      ) : !result ? (
        <div className="space-y-3">
          <Button className="w-full h-14 text-base bg-[#003087] hover:bg-[#002060]" onClick={() => { setResult(null); setChecked(false); setSent(false); setScanning(true); }}>
            <Camera className="w-5 h-5 mr-2" /> Scan QR code
          </Button>

          <div className="relative flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">or enter user ID</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <div className="flex gap-2">
            <Input className="h-11" value={scannedId} onChange={(e) => setScannedId(e.target.value)} placeholder="user_id…" />
            <Button className="h-11" variant="outline" onClick={() => void lookupId(scannedId)}>Check</Button>
          </div>

          <p className="text-xs text-slate-400">Try these demo users:</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "user_real_agent", label: "Real Agent" },
              { id: "user_fake_agent", label: "Fake Agent" },
              { id: "user_scammer", label: "Scammer" },
              { id: "user_praneel", label: "Praneel" },
              { id: "user_juma", label: "Juma" },
            ].map((u) => (
              <Button key={u.id} variant="outline" size="sm" onClick={() => void lookupId(u.id)}>{u.label}</Button>
            ))}
          </div>

          {checked && !result && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center mt-2">
              <ShieldAlert className="w-10 h-10 text-red-500 mx-auto" />
              <p className="font-bold text-red-600 mt-2">NOT FOUND</p>
              <p className="text-sm text-slate-500">Not registered. Do not trust this person.</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Scanned user profile + send money ── */
        <div className="space-y-4">
          <div className={`rounded-2xl border-2 p-5 ${isSafe ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-lg font-bold text-[#003087] dark:text-sky-400 shadow-sm">
                {result.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg">{result.name}</p>
                <p className="text-xs text-slate-500">{result.phone}</p>
              </div>
              <TrustRing score={result.trustScore} level={result.trustLevel} size={60} />
            </div>

            <div className="flex flex-wrap gap-1.5 mt-3">
              {result.verified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Unverified</Badge>}
              {result.faceHash && <Badge variant="success">Face ID</Badge>}
              {result.govIdUploaded && <Badge variant="success">Gov ID</Badge>}
              {result.isAgent && result.verified && <Badge variant="success">Licensed Agent</Badge>}
              {result.isAgent && !result.verified && <Badge variant="destructive">⚠ UNVERIFIED AGENT</Badge>}
              {result.revoked && <Badge variant="destructive">REVOKED</Badge>}
              {result.trustLevel === "SCAMMER" && <Badge variant="destructive">⚠ KNOWN SCAMMER</Badge>}
            </div>

            <div className={`mt-3 p-3 rounded-xl text-sm font-semibold ${isSafe ? "bg-white text-green-700" : "bg-white text-red-700"}`}>
              {isSafe ? `✓ This ${result.isAgent ? "agent" : "person"} is trusted. Safe to transact.` : `⚠ Do NOT send money to this ${result.isAgent ? "agent" : "person"}.`}
            </div>
          </div>

          {/* Send money section */}
          {isSafe && !sent && (
            <Card>
              <CardContent className="pt-5 space-y-3">
                <p className="text-sm font-semibold text-[#003087] dark:text-sky-400">Send money to {result.name}</p>
                <div>
                  <label className="text-xs text-slate-500">Amount (TZS)</label>
                  <Input className="h-12 text-2xl font-bold text-center mt-1" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} />
                  <p className="text-xs text-slate-400 text-center mt-1">≈ ${(Number(sendAmount) / 2500).toFixed(2)} USD</p>
                </div>
                <Button className="w-full h-12 bg-[#003087] hover:bg-[#002060]" onClick={() => setSent(true)}>
                  <Send className="w-4 h-4 mr-2" /> Send {Number(sendAmount).toLocaleString()} TZS
                </Button>
              </CardContent>
            </Card>
          )}

          {sent && (
            <div className="rounded-2xl bg-green-50 border border-green-200 p-6 text-center">
              <ShieldCheck className="w-12 h-12 text-green-500 mx-auto" />
              <p className="font-bold text-lg mt-3">Payment sent!</p>
              <p className="text-sm text-slate-500">{Number(sendAmount).toLocaleString()} TZS to {result.name}</p>
              <p className="text-xs text-slate-400 mt-1">Transaction verified by Indentix</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setResult(null); setChecked(false); setSent(false); }}>Scan another</Button>
            <Button variant="ghost" className="flex-1" onClick={onBack}>Back home</Button>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ── REVOKE ── */
function RevokeScreen({ me, onBack }: { me: User; onBack: () => void }) {
  const [done, setDone] = useState<string | null>(null);
  return (
    <Shell>
      <BackButton onClick={onBack} />
      <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2"><Ban className="w-5 h-5" /> Emergency</h2>
      {!me.revoked ? (
        <Card className="border-red-200">
          <CardContent className="pt-5 space-y-4">
            <p className="text-sm">Phone stolen or SIM swapped? Lock your identity immediately.</p>
            <Button variant="destructive" className="w-full h-12" onClick={async () => { const res = await api("/identity/revoke", { method: "POST", body: JSON.stringify({ userId: me.id }) }); const j = await res.json() as { message?: string }; setDone(j.message ?? "Locked"); }}>
              <Ban className="w-4 h-4 mr-2" /> Lock my identity NOW
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200">
          <CardContent className="pt-5 space-y-4 text-center">
            <Ban className="w-10 h-10 text-red-500 mx-auto" />
            <p className="font-bold text-red-600">Account is LOCKED</p>
            <p className="text-xs text-slate-500">Locked at {me.revokedAt ? new Date(me.revokedAt).toLocaleString() : "—"}</p>
            <Button className="w-full h-12 bg-[#003087] hover:bg-[#002060]" onClick={async () => { const res = await api("/identity/recover", { method: "POST", body: JSON.stringify({ userId: me.id }) }); const j = await res.json() as { message?: string }; setDone(j.message ?? "Recovered"); }}>
              <RotateCcw className="w-4 h-4 mr-2" /> Recover identity
            </Button>
          </CardContent>
        </Card>
      )}
      {done && <div className="mt-3 rounded-xl bg-green-50 border border-green-200 p-4 text-center text-sm font-semibold text-green-700">{done}</div>}
    </Shell>
  );
}

/* ── ONBOARDING ── */
function OnboardingScreen({ me: initialMe, onDone }: { me: User; onDone: () => void }) {
  const [me, setMe] = useState(initialMe);
  const [step, setStep] = useState(0);
  const [idImage, setIdImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => { return () => { streamRef.current?.getTracks().forEach(t => t.stop()); }; }, []);

  const refreshUser = async () => {
    const res = await api(`/user/${me.id}`);
    const j = await res.json() as { user?: User };
    if (j.user) setMe(j.user);
  };

  const STEPS = [
    { key: "face", label: "Face scan", points: "+25 trust", icon: <ScanFace className="w-5 h-5" /> },
    { key: "govid", label: "Government ID", points: "+15 trust", icon: <CreditCard className="w-5 h-5" /> },
    { key: "done", label: "Complete", points: "+30 trust", icon: <ShieldCheck className="w-5 h-5" /> },
  ];

  return (
    <Shell>
      {/* Trust score header — live */}
      <div className="text-center mb-5">
        <TrustRing score={me.trustScore} level={me.trustLevel} size={80} />
        <p className="text-xs text-slate-500 mt-1">Your trust score builds with each step</p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center justify-between mb-6 px-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex flex-col items-center flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm ${i < step ? "bg-green-500 text-white" : i === step ? "bg-[#003087] text-white" : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"}`}>
              {i < step ? "✓" : s.icon}
            </div>
            <span className={`text-[0.6rem] mt-1 font-semibold ${i <= step ? "text-[#003087] dark:text-sky-400" : "text-slate-400 dark:text-slate-500"}`}>{s.label}</span>
            <span className="text-[0.55rem] text-slate-400 dark:text-slate-500">{s.points}</span>
            {i < STEPS.length - 1 && <div className={`absolute`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Face scan */}
      {step === 0 && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="text-lg font-bold mb-1">Scan your face</h3>
            <p className="text-sm text-slate-500 mb-3">Your face is your identity. This prevents impersonation and creates a unique biometric hash.</p>
            <FaceScanner mode="enroll" userId={me.id} onComplete={async () => { await refreshUser(); setStep(1); }} onClose={() => setStep(1)} />
            <Button variant="ghost" size="sm" className="w-full mt-2 text-slate-400" onClick={() => setStep(1)}>Skip for now</Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Government ID */}
      {step === 1 && (
        <Card>
          <CardContent className="pt-5">
            <h3 className="text-lg font-bold mb-1">Government ID</h3>
            <p className="text-sm text-slate-500 mb-3">Photo your passport, national ID, or driver's license. This boosts your trust score.</p>
            {!idImage ? (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={async () => {
                    try {
                      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
                      streamRef.current = s;
                      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
                    } catch { /* camera denied */ }
                  }}>Open camera</Button>
                  <Button className="flex-1 bg-[#003087]" onClick={() => {
                    const v = videoRef.current;
                    if (!v || !v.videoWidth) return;
                    const c = document.createElement("canvas");
                    c.width = v.videoWidth; c.height = v.videoHeight;
                    c.getContext("2d")!.drawImage(v, 0, 0);
                    setIdImage(c.toDataURL("image/jpeg", 0.6));
                    streamRef.current?.getTracks().forEach(t => t.stop());
                  }}>Capture photo</Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full text-slate-400" onClick={() => { setIdImage("mock"); }}>Use demo ID</Button>
                <Button variant="ghost" size="sm" className="w-full text-slate-400" onClick={() => setStep(2)}>Skip for now</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {idImage.startsWith("data:") ? (
                  <img src={idImage} className="rounded-xl w-full" alt="Government ID" />
                ) : (
                  <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center">
                    <ShieldCheck className="w-8 h-8 text-green-500 mx-auto" />
                    <p className="font-semibold mt-2">ID captured</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button className="flex-1 bg-[#003087]" onClick={async () => {
                    await api("/govid/upload", { method: "POST", body: JSON.stringify({ userId: me.id, image: idImage }) });
                    await refreshUser();
                    setStep(2);
                  }}>Upload & continue</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setIdImage(null)}>Retake</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Complete */}
      {step === 2 && (
        <Card>
          <CardContent className="pt-5 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-500 flex items-center justify-center">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold">You're verified!</h3>
            <p className="text-sm text-slate-500">Share your QR code so others can verify you before transacting.</p>

            {/* Final trust score preview */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4">
              <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Your trust score</p>
              <TrustRing score={me.trustScore + 30} level="VERIFIED" size={70} />
              <div className="flex justify-center gap-2 mt-2">
                {me.faceHash && <Badge variant="success">Face ID ✓</Badge>}
                {me.govIdUploaded && <Badge variant="success">Gov ID ✓</Badge>}
                <Badge variant="success">Verified ✓</Badge>
              </div>
            </div>

            <div className="flex justify-center">
              <QRCodeSVG value={`${window.location.origin}/verify/${me.id}`} size={140} />
            </div>
            <p className="text-[0.65rem] text-slate-300 break-all">{window.location.origin}/verify/{me.id}</p>

            <Button className="w-full h-12 bg-[#003087] hover:bg-[#002060]" onClick={async () => {
              await api("/onboarding/complete", { method: "POST", body: JSON.stringify({ userId: me.id }) });
              onDone();
            }}>Go to dashboard</Button>
          </CardContent>
        </Card>
      )}
    </Shell>
  );
}

/* ── PUBLIC VERIFY ── */
function PublicVerifyScreen({
  userId,
  me,
  onBack,
  onSignInToSend,
  onSendMoney,
}: {
  userId: string;
  me: User | null;
  onBack: () => void;
  onSignInToSend: (userId: string) => void;
  onSendMoney: (userId: string) => void;
}) {
  const [data, setData] = useState<{ name: string; phone: string; verified: boolean; faceEnrolled: boolean; govIdUploaded: boolean; trustScore: number; trustLevel: string; isAgent: boolean; revoked: boolean; memberSince: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const res = await api(`/public/verify/${userId}`);
      if (res.ok) setData(await res.json() as typeof data);
      else setErr("User not found");
    })();
  }, [userId]);

  const isSafe = data && data.trustScore >= 50 && !data.revoked;

  return (
    <Shell>
      <BackButton onClick={onBack} />
      <div className="flex justify-center mb-2">
        <IndentixLogo className="h-12 w-12" />
      </div>
      <p className="text-center text-sm text-slate-500 mb-1">Verify before you pay</p>
      {err && <div className="text-center mt-8"><ShieldAlert className="w-12 h-12 text-red-500 mx-auto" /><p className="font-bold text-red-600 mt-3 text-lg">{err}</p></div>}
      {data && (
        <div className="text-center space-y-4 mt-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Trust</p>
            <TrustRing score={data.trustScore} level={data.trustLevel} size={100} />
            <p className="mt-3 text-lg font-bold text-[#003087] dark:text-sky-400">{data.trustScore}<span className="text-sm font-normal text-slate-500">/100</span></p>
            <p className="text-xs text-slate-500">{data.trustLevel.replace(/_/g, " ")}</p>
          </div>
          <h2 className="text-2xl font-bold">{data.name}</h2>
          <p className="text-sm text-slate-500">{data.phone}</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {data.verified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Unverified</Badge>}
            {data.faceEnrolled && <Badge variant="success">Face ID</Badge>}
            {data.govIdUploaded && <Badge variant="success">Gov ID</Badge>}
            {data.isAgent && data.verified && <Badge variant="success">Licensed Agent</Badge>}
            {data.isAgent && !data.verified && <Badge variant="destructive">UNVERIFIED AGENT</Badge>}
            {data.revoked && <Badge variant="destructive">REVOKED</Badge>}
          </div>
          <div className={`rounded-xl p-4 ${isSafe ? "bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-900" : "bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900"}`}>
            <p className={`font-semibold ${isSafe ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
              {isSafe ? `✓ This profile looks trusted — safer to transact` : `⚠ Do not send money to this profile`}
            </p>
          </div>

          {isSafe && (
            <Card className="text-left">
              <CardContent className="pt-5 space-y-3">
                <p className="text-sm font-semibold text-[#003087] dark:text-sky-400 flex items-center gap-2">
                  <Send className="w-4 h-4" /> Send money to {data.name}
                </p>
                <p className="text-xs text-slate-500">Recipient is loaded from this verified profile after you continue.</p>
                {me ? (
                  <Button className="w-full h-12 bg-[#003087] hover:bg-[#002060]" onClick={() => onSendMoney(userId)}>
                    Continue to send money
                  </Button>
                ) : (
                  <Button className="w-full h-12 bg-[#003087] hover:bg-[#002060]" onClick={() => onSignInToSend(userId)}>
                    Sign in to send money
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-slate-400">Member since {new Date(data.memberSince).toLocaleDateString()}</p>
        </div>
      )}
    </Shell>
  );
}

/* ── FACE SCREENS ── */
/* ── FACE LOGIN (verify face before granting access) ── */
function FaceLoginScreen({ userId, userName, onVerify, onBack, error }: { userId: string; userName: string | null; onVerify: (embedding: number[]) => void; onBack: () => void; error: string | null }) {
  const [scanning, setScanning] = useState(false);
  return (
    <Shell>
      <div className="text-center mt-4 mb-6">
        <div className="mx-auto mb-3 flex justify-center">
          <IndentixLogo className="h-16 w-16" />
        </div>
        <h2 className="text-xl font-bold text-[#003087] dark:text-sky-400">Verify your identity</h2>
        <p className="text-sm text-slate-500 mt-1">Hi {userName ?? "there"}! Your face must match the one on file for this account before you can continue.</p>
      </div>

      {!scanning ? (
        <div className="space-y-3">
          <Button className="w-full h-14 text-base bg-[#003087] hover:bg-[#002060]" onClick={() => setScanning(true)}>
            <ScanFace className="w-5 h-5 mr-2" /> Scan my face
          </Button>
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
              <ShieldAlert className="w-6 h-6 text-red-500 mx-auto mb-1" />
              <p className="text-sm text-red-700 font-semibold">{error}</p>
              <p className="text-xs text-red-500 mt-1">Make sure you are the account owner.</p>
            </div>
          )}
          <Button variant="ghost" className="w-full text-slate-400" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Use a different account
          </Button>
        </div>
      ) : (
        <FaceScanner mode="verify" userId={userId} onComplete={() => {}} onClose={() => setScanning(false)}
          onCapture={(embedding) => { setScanning(false); onVerify(embedding); }}
        />
      )}
    </Shell>
  );
}

function FaceEnrollScreen({ me, onDone }: { me: User; onDone: () => void }) { return <Shell><FaceScanner mode="enroll" userId={me.id} onComplete={onDone} onClose={onDone} /></Shell>; }
function FaceVerifyScreen({ me, onDone }: { me: User; onDone: () => void }) { return <Shell><FaceScanner mode="verify" userId={me.id} onComplete={onDone} onClose={onDone} /></Shell>; }

/* ── DEMO ── */
function DemoScreen({ onBack, onLogin }: { onBack: () => void; onLogin: (ph: string) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => { void (async () => { const res = await api("/demo/users"); const j = await res.json() as { users: User[] }; setUsers(j.users ?? []); })(); }, []);
  return (
    <Shell>
      <BackButton onClick={onBack} />
      <div className="flex items-center gap-2 mb-1">
        <IndentixLogo className="h-10 w-10" />
        <h2 className="text-xl font-bold text-[#003087] dark:text-sky-400">Demo mode</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">Tap to login as any user.</p>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" onClick={() => onLogin(u.phone)}>
            <div className="w-10 h-10 rounded-full bg-[#003087] flex items-center justify-center text-white text-xs font-bold">{u.name.split(" ").map(n => n[0]).join("")}</div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{u.name}</p>
              <p className="text-xs text-slate-400">{u.phone} {u.isAgent ? "· Agent" : ""}</p>
            </div>
            <div className="text-right">
              <Badge variant={u.trustScore >= 50 ? "success" : u.trustLevel === "SCAMMER" ? "destructive" : "warning"}>{u.trustLevel}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ── Trust Ring ── */
function TrustRing({ score, level, size = 70 }: { score: number; level: string; size?: number }) {
  const r = size * 0.38; const circ = 2 * Math.PI * r; const offset = circ - (score / 100) * circ;
  const c = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : score >= 25 ? "#6366f1" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="inline-block">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth="4" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.5s" }} />
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" style={{ fontSize: size * 0.22, fontWeight: 700, fill: "#0f172a" }}>{score}</text>
      <text x={size / 2} y={size / 2 + size * 0.12} textAnchor="middle" style={{ fontSize: size * 0.09, fontWeight: 600, fill: c }}>{level}</text>
    </svg>
  );
}
