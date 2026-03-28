import { useState, useEffect, useCallback, useRef, useMemo, type Dispatch, type SetStateAction } from "react";
import { api } from "./api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FaceScanner } from "./components/FaceScanner";
import { IndentixLogo } from "./components/IndentixLogo";
import { QRCodeSVG } from "qrcode.react";
import { QrScanner } from "./components/QrScanner";
import { PhoneInput } from "./components/PhoneInput";
import { hasMinimumNationalDigits } from "@/lib/countryCodes";
import { normalizeAndValidatePhone } from "@/lib/phoneValidate";
import { parseRecoveryEmailInput } from "@/lib/recoveryEmail";
import { ConnectivityBar } from "@/components/ConnectivityBar";
import { FraudReportScreen } from "@/screens/FraudReportScreen";
import { IdentityCheckScreen } from "@/screens/IdentityCheckScreen";
import { OfflineModeScreen } from "@/screens/OfflineModeScreen";
import { AgentSupportScreen } from "@/screens/AgentSupportScreen";
import { MerchantProfileScreen } from "@/screens/MerchantProfileScreen";
import type { Screen as SalamaScreen, ConnectivityStatus } from "@/types";
import { useEasyMode } from "@/context/EasyModeContext";
import { EasyModeBanner, EasyModeHomeChip } from "@/components/EasyModeBanner";
import { SpeakAloudButton } from "@/components/SpeakAloudButton";
import { useDesktopPhoneFramed } from "@/components/DesktopPhoneFrame";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, ShieldAlert, ScanFace, QrCode, Send,
  AlertTriangle, Phone, UserCheck, Ban, RotateCcw,
  Smartphone, Search, ChevronLeft, LogOut, Home,
  Wallet, ArrowUpRight, ArrowDownLeft, CreditCard, Camera,
  Flag, Store, RefreshCw,
} from "lucide-react";

type Tx = {
  id: string; from: string; to: string; amount: number;
  currency: string; status: "confirmed" | "pending" | "fake"; timestamp: string;
};

type User = {
  id: string; phone: string; name: string; passwordSet?: boolean; verified: boolean;
  recoveryEmail?: string | null;
  faceHash: string | null; faceEnrolledAt: string | null;
  govIdUploaded: boolean; govIdUploadedAt: string | null;
  onboarded: boolean; balance: number;
  trustScore: number; trustLevel: string;
  isAgent: boolean; revoked: boolean; revokedAt: string | null;
  createdAt: string; transactionCount: number; transactions: Tx[];
};

type Screen =
  | "login"
  | "face-login"
  | "onboarding"
  | "home"
  | "send"
  | "scan"
  | "revoke"
  | "face-enroll"
  | "face-verify"
  | "demo"
  | "public-verify"
  | "wallet"
  | "activity"
  | "fraud-report"
  | "fraud-check"
  | "fraud-queue"
  | "fraud-agent"
  | "fraud-merchant";

const POST_LOGIN_SEND_KEY = "indentix_post_login_send_user_id";

const SALAMA_CONNECTIVITY: ConnectivityStatus[] = ["online", "weak", "offline"];

function mapSalamaToIndentix(s: SalamaScreen): Screen {
  const m: Record<SalamaScreen, Screen> = {
    home: "home",
    report: "fraud-report",
    check: "fraud-check",
    offline: "fraud-queue",
    agent: "fraud-agent",
    merchant: "fraud-merchant",
  };
  return m[s];
}

/** Sync status bar + Indentix column; used on every screen so connectivity state stays consistent. */
function ConnectivityShell({
  connectivityIdx,
  setConnectivityIdx,
  lastSynced,
  children,
}: {
  connectivityIdx: number;
  setConnectivityIdx: Dispatch<SetStateAction<number>>;
  lastSynced: Date;
  children: React.ReactNode;
}) {
  const connectivity = SALAMA_CONNECTIVITY[connectivityIdx % SALAMA_CONNECTIVITY.length];
  const framed = useDesktopPhoneFramed();
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100",
        framed ? "h-full min-h-0 max-w-none flex-1" : "min-h-screen max-w-sm",
      )}
    >
      <ConnectivityBar
        status={connectivity}
        lastSynced={lastSynced}
        onCycle={() => setConnectivityIdx((i) => (i + 1) % SALAMA_CONNECTIVITY.length)}
      />
      {framed ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}

function parseVerifyPath(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/^\/verify\/([a-zA-Z0-9_]+)\/?$/);
  return m ? m[1] : null;
}

export function App() {
  const [screen, setScreen] = useState<Screen>(() => (parseVerifyPath() ? "public-verify" : "login"));
  const [me, setMe] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [publicVerifyId, setPublicVerifyId] = useState<string | null>(() => parseVerifyPath());
  const [sendPrefillUserId, setSendPrefillUserId] = useState<string | null>(null);
  const [pendingLoginUserId, setPendingLoginUserId] = useState<string | null>(null);
  const [pendingLoginUserName, setPendingLoginUserName] = useState<string | null>(null);
  const [salamaConnectivityIdx, setSalamaConnectivityIdx] = useState(0);
  const salamaLastSynced = useMemo(() => new Date(Date.now() - 14 * 60000), []);

  const clearSendPrefill = useCallback(() => setSendPrefillUserId(null), []);
  const onSalamaNavigate = useCallback((s: SalamaScreen) => setScreen(mapSalamaToIndentix(s)), []);

  const salamaConnectivity = SALAMA_CONNECTIVITY[salamaConnectivityIdx % SALAMA_CONNECTIVITY.length];

  const login = async (ph: string, password?: string, demoLogin = false) => {
    setError(null);
    const body: Record<string, unknown> = { phone: ph, password: password ?? "" };
    if (demoLogin) body.demoLogin = true;
    const res = await api("/auth/login", { method: "POST", body: JSON.stringify(body) });
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

  const register = async (name: string, ph: string, password: string, recoveryEmail?: string | null) => {
    setError(null);
    const res = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ phone: ph, name, password, recoveryEmail: recoveryEmail ?? null }),
    });
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
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
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
        </div>
      </ConnectivityShell>
    );
  }
  if (screen === "login") {
    return (
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
          <LoginScreen
            phone={phone}
            setPhone={setPhone}
            onLogin={(ph, pw) => void login(ph, pw)}
            onRegister={(name, ph, pw, recoveryEmail) => void register(name, ph, pw, recoveryEmail)}
            onClearError={() => setError(null)}
            onDemo={() => setScreen("demo")}
            error={error}
          />
        </div>
      </ConnectivityShell>
    );
  }
  if (screen === "face-login") {
    return (
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
          <FaceLoginScreen userId={pendingLoginUserId!} userName={pendingLoginUserName} onVerify={(emb) => void verifyFaceLogin(emb)} onBack={() => { setPendingLoginUserId(null); setScreen("login"); }} error={error} />
        </div>
      </ConnectivityShell>
    );
  }
  if (screen === "demo") {
    return (
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
          <DemoScreen onBack={() => setScreen("login")} onLogin={(ph) => { void login(ph, "", true); }} />
        </div>
      </ConnectivityShell>
    );
  }
  if (!me) return null;
  if (screen === "onboarding") {
    return (
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
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
        </div>
      </ConnectivityShell>
    );
  }
  if (screen === "scan") {
    return (
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
          <ScanScreen me={me} onBack={() => setScreen("home")} />
        </div>
      </ConnectivityShell>
    );
  }
  if (screen === "revoke") {
    return (
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
          <RevokeScreen me={me} onBack={() => { void refresh(); setScreen("home"); }} />
        </div>
      </ConnectivityShell>
    );
  }
  if (screen === "face-enroll") {
    return (
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
          <FaceEnrollScreen me={me} onDone={() => { void refresh(); setScreen("home"); }} />
        </div>
      </ConnectivityShell>
    );
  }
  if (screen === "face-verify") {
    return (
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
          <FaceVerifyScreen me={me} onDone={() => setScreen("home")} />
        </div>
      </ConnectivityShell>
    );
  }
  if (screen === "fraud-report") {
    return (
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
          <FraudReportScreen onNavigate={onSalamaNavigate} connectivity={salamaConnectivity} />
        </div>
      </ConnectivityShell>
    );
  }
  if (screen === "fraud-check") {
    return (
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
          <IdentityCheckScreen onNavigate={onSalamaNavigate} connectivity={salamaConnectivity} />
        </div>
      </ConnectivityShell>
    );
  }
  if (screen === "fraud-queue") {
    return (
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
          <OfflineModeScreen onNavigate={onSalamaNavigate} connectivity={salamaConnectivity} lastSynced={salamaLastSynced} />
        </div>
      </ConnectivityShell>
    );
  }
  if (screen === "fraud-agent") {
    return (
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
          <AgentSupportScreen onNavigate={onSalamaNavigate} />
        </div>
      </ConnectivityShell>
    );
  }
  if (screen === "fraud-merchant") {
    return (
      <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
        <div className="flex-1 min-h-0 overflow-auto">
          <MerchantProfileScreen onNavigate={onSalamaNavigate} />
        </div>
      </ConnectivityShell>
    );
  }

  /* Home / Wallet / Activity / Send share the same bottom nav */
  return (
    <ConnectivityShell connectivityIdx={salamaConnectivityIdx} setConnectivityIdx={setSalamaConnectivityIdx} lastSynced={salamaLastSynced}>
      <div className="flex-1 min-h-0 overflow-auto pb-20">
        {screen === "home" && <HomeTab me={me} setScreen={setScreen} onLogout={logout} />}
        {screen === "send" && (
          <SendMoneyScreen
            me={me}
            initialRecipientUserId={sendPrefillUserId}
            onConsumedPrefill={clearSendPrefill}
            onBack={() => {
              clearSendPrefill();
              setScreen("home");
            }}
          />
        )}
        {screen === "wallet" && <WalletTab me={me} />}
        {screen === "activity" && <ActivityTab me={me} />}
      </div>
      <BottomNav active={screen} onNav={setScreen} />
    </ConnectivityShell>
  );
}

/* ══════════════════════════════════════════════
   HOME TAB — PayPal style
   ══════════════════════════════════════════════ */
function SendGuidedDots({ step }: { step: number }) {
  return (
    <div className="mb-3 flex justify-center gap-2" aria-hidden>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-2.5 rounded-full transition-all ${n <= step ? "w-8 bg-[#003087]" : "w-2.5 bg-slate-200"}`}
        />
      ))}
    </div>
  );
}

function HomeTab({ me, setScreen, onLogout }: { me: User; setScreen: (s: Screen) => void; onLogout: () => void }) {
  const { easyMode } = useEasyMode();
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
          <div className="flex items-center gap-2 shrink-0">
            <EasyModeHomeChip />
            <button type="button" onClick={onLogout} className="text-white/50 hover:text-white/80" aria-label="Log out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-xs text-white/60 uppercase tracking-wider">{easyMode ? "Your money" : "Indentix balance"}</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-4xl font-bold">
            {me.balance.toLocaleString()} <span className="text-lg font-normal text-white/50">TZS</span>
          </p>
          {easyMode && (
            <SpeakAloudButton
              text={`Your balance is ${me.balance.toLocaleString()} Tanzanian shillings.`}
              label="Read balance out loud"
              className="border-white/40 bg-white/15 text-white hover:bg-white/25"
            />
          )}
        </div>
        <p className="text-xs text-white/40 mt-1">≈ ${(me.balance / 2500).toFixed(2)} USD</p>

        {/* Send / Request / Scan */}
        <div className="flex justify-around mt-6">
          <NavBtn
            icon={<ArrowUpRight className="w-5 h-5" />}
            label={easyMode ? "Pay" : "Send"}
            onClick={() => setScreen("send")}
          />
          <NavBtn
            icon={<QrCode className="w-5 h-5" />}
            label={easyMode ? "Scan" : "Scan"}
            onClick={() => setScreen("scan")}
          />
          <NavBtn
            icon={<ScanFace className="w-5 h-5" />}
            label={easyMode ? (me.faceHash ? "My face" : "Add face") : me.faceHash ? "Verify" : "Face ID"}
            onClick={() => setScreen(me.faceHash ? "face-verify" : "face-enroll")}
          />
          <NavBtn
            icon={<Ban className="w-5 h-5" />}
            label={easyMode ? "Lock" : "Lock"}
            onClick={() => setScreen("revoke")}
          />
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

        <Card className="mt-3 border-slate-200 shadow-sm">
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {easyMode ? "Stay safe" : "Safety & reports"}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {easyMode
                    ? "If someone tricks you, tap Report. Before you pay a stranger, tap Check."
                    : "Fraud reporting and identity checks before you pay."}
                </p>
              </div>
              {easyMode && (
                <SpeakAloudButton
                  text="Stay safe. If someone cheats you, press Report fraud. Before you pay someone you do not know well, press Check identity."
                  label="Read safety tips"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-auto flex-col gap-1 py-3" onClick={() => setScreen("fraud-report")}>
                <Flag className="h-4 w-4" aria-hidden />
                <span className="text-xs font-semibold">{easyMode ? "Report" : "Report fraud"}</span>
              </Button>
              <Button type="button" variant="outline" className="h-auto flex-col gap-1 py-3" onClick={() => setScreen("fraud-check")}>
                <ShieldCheck className="h-4 w-4" aria-hidden />
                <span className="text-xs font-semibold">{easyMode ? "Check ID" : "Check identity"}</span>
              </Button>
              <Button type="button" variant="outline" className="h-auto flex-col gap-1 py-3" onClick={() => setScreen("fraud-queue")}>
                <RefreshCw className="h-4 w-4" aria-hidden />
                <span className="text-xs font-semibold">{easyMode ? "Waiting list" : "Offline queue"}</span>
              </Button>
              <Button type="button" variant="outline" className="h-auto flex-col gap-1 py-3" onClick={() => setScreen("fraud-agent")}>
                <UserCheck className="h-4 w-4" aria-hidden />
                <span className="text-xs font-semibold">{easyMode ? "Help desk" : "Agent support"}</span>
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm" className="w-full text-xs" onClick={() => setScreen("fraud-merchant")}>
              <Store className="mr-1 h-4 w-4" aria-hidden />
              Merchant profile (demo)
            </Button>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <div className="mt-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {easyMode ? "Latest money" : "Recent activity"}
          </p>
          {me.transactions.length === 0 && <p className="text-sm text-slate-400">No transactions yet.</p>}
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
  const { easyMode } = useEasyMode();
  return (
    <div className="px-5 pt-6">
      <h2 className="text-lg font-bold mb-4">{easyMode ? "My details" : "Wallet"}</h2>
      <Card className="bg-gradient-to-br from-[#003087] to-[#001e5a] text-white">
        <CardContent className="pt-5 pb-5">
          <p className="text-xs text-white/60">{easyMode ? "Your money" : "Indentix balance"}</p>
          <p className="text-3xl font-bold mt-1">{me.balance.toLocaleString()} TZS</p>
          <p className="text-xs text-white/40 mt-1">≈ ${(me.balance / 2500).toFixed(2)} USD</p>
        </CardContent>
      </Card>

      <div className="mt-5 space-y-3">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {easyMode ? "About you" : "Account details"}
        </p>
        <Row label={easyMode ? "Your phone" : "Phone"} value={me.phone} />
        <Row
          label={easyMode ? "Backup email" : "Recovery email"}
          value={me.recoveryEmail ?? (easyMode ? "None" : "Not set")}
          color={me.recoveryEmail ? undefined : "text-amber-600"}
        />
        <Row
          label={easyMode ? "Trust" : "Trust score"}
          value={easyMode ? `${me.trustScore} of 100` : `${me.trustScore}/100 (${me.trustLevel})`}
        />
        <Row
          label={easyMode ? "Face photo" : "Face ID"}
          value={me.faceHash ? (easyMode ? "Yes" : "Enrolled") : easyMode ? "No" : "Not set"}
          color={me.faceHash ? "text-green-600" : "text-amber-500"}
        />
        <Row
          label={easyMode ? "ID paper" : "Gov ID"}
          value={me.govIdUploaded ? (easyMode ? "Yes" : "Uploaded") : easyMode ? "No" : "Not uploaded"}
          color={me.govIdUploaded ? "text-green-600" : "text-amber-500"}
        />
        <Row
          label={easyMode ? "Account OK?" : "Status"}
          value={
            me.verified
              ? easyMode
                ? "OK"
                : "Verified"
              : me.revoked
                ? easyMode
                  ? "Blocked"
                  : "Revoked"
                : easyMode
                  ? "Wait"
                  : "Unverified"
          }
          color={me.verified ? "text-green-600" : "text-red-500"}
        />
        <Row label={easyMode ? "Joined" : "Member since"} value={new Date(me.createdAt ?? "").toLocaleDateString()} />
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
  const { easyMode } = useEasyMode();
  const framed = useDesktopPhoneFramed();
  const items: { screen: Screen; icon: React.ReactNode; label: string }[] = [
    { screen: "home", icon: <Home className="w-5 h-5" />, label: "Home" },
    { screen: "send", icon: <Send className="w-5 h-5" />, label: easyMode ? "Send" : "Payments" },
    { screen: "wallet", icon: <Wallet className="w-5 h-5" />, label: easyMode ? "Me" : "Wallet" },
    { screen: "activity", icon: <CreditCard className="w-5 h-5" />, label: easyMode ? "List" : "Activity" },
  ];
  return (
    <div
      className={cn(
        "z-50 flex w-full justify-around border-t border-slate-200 bg-white py-2 dark:border-slate-800 dark:bg-slate-950",
        framed ? "relative shrink-0" : "fixed bottom-0 left-1/2 max-w-sm -translate-x-1/2",
      )}
    >
      {items.map((it) => {
        const isActive = active === it.screen;
        return (
          <button key={it.screen} type="button" onClick={() => onNav(it.screen)} className={`flex flex-col items-center gap-0.5 py-1 px-3 ${isActive ? "text-[#003087]" : "text-slate-400"}`}>
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
  return <div className="px-5 py-6">{children}</div>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-1 text-sm text-[#003087] mb-4 hover:underline"><ChevronLeft className="w-4 h-4" /> Back</button>;
}

/* ── LOGIN ── */
function LoginScreen({ phone, setPhone, onLogin, onRegister, onClearError, onDemo, error }: {
  phone: string; setPhone: (v: string) => void;
  onLogin: (ph: string, password?: string) => void;
  onRegister: (name: string, ph: string, password: string, recoveryEmail?: string | null) => void;
  onClearError: () => void;
  onDemo: () => void; error: string | null;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { easyMode } = useEasyMode();

  const submit = () => {
    setLocalError(null);
    const phoneCheck = normalizeAndValidatePhone(phone);
    if (!phoneCheck.ok) {
      setLocalError(phoneCheck.error);
      return;
    }
    if (mode === "signup") {
      if (!name.trim()) return;
      if (password.length < 8) return;
      if (password !== confirm) return;
      const em = parseRecoveryEmailInput(recoveryEmail);
      if (!em.ok) {
        setLocalError(em.error);
        return;
      }
      onRegister(name.trim(), phoneCheck.e164, password, em.email);
      return;
    }
    onLogin(phoneCheck.e164, password);
  };

  const loginVoiceHelp =
    mode === "signin"
      ? easyMode
        ? "I already use Indentix. Put my phone number. Then tap Open my account. If the app asks for my face, I look at the camera."
        : "Sign in with your phone number. If you use Face ID on this account, you will verify your face after tapping sign in."
      : easyMode
        ? "I am new. Step one: my name. Step two: my phone. Step three: secret word twice. Step four is optional backup email."
        : "Create an account with your name, phone, password, and optional recovery email.";

  return (
    <Shell>
      <EasyModeBanner />
      <div className="text-center mb-8 mt-2">
        <div className="mx-auto mb-4 flex justify-center">
          <IndentixLogo className="h-20 w-20" />
        </div>
        <div className="flex items-start justify-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-[#003087] dark:text-sky-400">Indentix</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {easyMode ? "Pay people with your phone. We keep it simple." : "Trusted mobile payments for Tanzania"}
            </p>
          </div>
          {easyMode && <SpeakAloudButton text={loginVoiceHelp} label="Read sign-in help" className="mt-1" />}
        </div>
      </div>
      <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-4">
        <button
          type="button"
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${mode === "signin" ? "bg-white dark:bg-slate-950 text-[#003087] dark:text-sky-400 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
          onClick={() => {
            setMode("signin");
            setLocalError(null);
            onClearError();
          }}
        >
          {easyMode ? "I use Indentix" : "Sign in"}
        </button>
        <button
          type="button"
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${mode === "signup" ? "bg-white dark:bg-slate-950 text-[#003087] dark:text-sky-400 shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
          onClick={() => {
            setMode("signup");
            setLocalError(null);
            onClearError();
          }}
        >
          {easyMode ? "I am new" : "Sign up"}
        </button>
      </div>
      {easyMode && mode === "signup" && (
        <ol className="mb-4 list-inside list-decimal space-y-1.5 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-950">
          <li>Your name</li>
          <li>Your phone</li>
          <li>Secret word, two times</li>
          <li>Backup email — you can skip</li>
        </ol>
      )}
      <div className="space-y-4">
        {mode === "signup" && (
          <div>
            <label className={`font-medium text-slate-700 dark:text-slate-300 ${easyMode ? "text-lg" : "text-sm"}`}>
              {easyMode ? "Your name" : "Full name"}
            </label>
            <Input
              className={`mt-1.5 text-base ${easyMode ? "h-14 text-lg" : "h-12"}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amina Juma"
              autoComplete="name"
            />
          </div>
        )}
        <PhoneInput
          id="login-phone"
          label={easyMode ? "Your phone number" : "Phone number"}
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
          easyRead={easyMode}
        />
        {mode === "signup" && (
          <div>
            <label className={`font-medium text-slate-700 dark:text-slate-300 ${easyMode ? "text-lg" : "text-sm"}`}>
              {easyMode ? "Backup email (skip if you want)" : "Recovery email (optional)"}
            </label>
            <Input
              className={`mt-1.5 text-base ${easyMode ? "h-14 text-lg" : "h-12"}`}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
            />
            <p className="text-[0.65rem] text-slate-400 mt-1.5 leading-snug">
              {easyMode
                ? "Only if you lose your phone. This demo does not send mail."
                : "Used if you lose access to your phone. We do not send email in this demo—only stored securely on your profile."}
            </p>
          </div>
        )}
        <div>
          <label className={`font-medium text-slate-700 dark:text-slate-300 ${easyMode ? "text-lg" : "text-sm"}`}>
            {easyMode ? "Secret word (password)" : "Password"}
          </label>
          <Input
            className={`mt-1.5 text-base ${easyMode ? "h-14 text-lg" : "h-12"}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              mode === "signin"
                ? easyMode
                  ? "Your secret word"
                  : "Password you set at sign up"
                : easyMode
                  ? "8 letters or more"
                  : "At least 8 characters"
            }
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          {mode === "signin" && (
            <p className="text-[0.65rem] text-slate-400 mt-1.5 leading-snug">
              {easyMode
                ? "Type your secret word. For sample people without one, tap Try demo."
                : "Password is required for sign in. If you enrolled Face ID on this account, you will scan your face after the password. To try built-in demo users without passwords, use Demo mode below."}
            </p>
          )}
        </div>
        {mode === "signup" && (
          <div>
            <label className={`font-medium text-slate-700 dark:text-slate-300 ${easyMode ? "text-lg" : "text-sm"}`}>
              {easyMode ? "Type secret word again" : "Confirm password"}
            </label>
            <Input
              className={`mt-1.5 text-base ${easyMode ? "h-14 text-lg" : "h-12"}`}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={easyMode ? "Same as above" : "Repeat password"}
              type="password"
              autoComplete="new-password"
            />
          </div>
        )}
        <Button
          className={`w-full text-base bg-[#003087] hover:bg-[#002060] ${easyMode ? "h-14 text-lg" : "h-12"}`}
          onClick={submit}
          disabled={
            !hasMinimumNationalDigits(phone) ||
            (mode === "signin" && !password.trim()) ||
            (mode === "signup" && (!name.trim() || password.length < 8 || password !== confirm))
          }
        >
          <Phone className="w-4 h-4 mr-2" />{" "}
          {mode === "signin" ? (easyMode ? "Open my account" : "Sign in") : easyMode ? "Make my account" : "Create account"}
        </Button>
        {mode === "signup" && password.length > 0 && password.length < 8 && (
          <p className="text-xs text-amber-600 text-center">{easyMode ? "Use 8 or more characters." : "Use at least 8 characters."}</p>
        )}
        {mode === "signup" && confirm.length > 0 && password !== confirm && (
          <p className="text-xs text-red-500 text-center">{easyMode ? "Both secret words must match." : "Passwords do not match."}</p>
        )}
        {(localError || error) && (
          <p className={`text-red-500 text-center ${easyMode ? "text-sm" : "text-xs"}`}>{localError ?? error}</p>
        )}
        <div className="relative flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <Button variant="outline" className={`w-full ${easyMode ? "h-14 text-base" : "h-11"}`} onClick={onDemo}>
          <Smartphone className="w-4 h-4 mr-2" /> {easyMode ? "Try demo" : "Demo mode"}
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
  const [lookupError, setLookupError] = useState<string | null>(null);
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
    setLookupError(null);
    const phoneCheck = normalizeAndValidatePhone(recipientPhone);
    if (!phoneCheck.ok) {
      setLookupError(phoneCheck.error);
      setRecipient(null);
      setLookupDone(false);
      return;
    }
    setRecipient(null); setLookupDone(false);
    const res = await api(`/lookup/phone/${encodeURIComponent(phoneCheck.e164)}`);
    const j = await res.json() as { user?: User };
    setRecipient(j.user ?? null);
    setLookupDone(true);
  };

  const isSafe = recipient && recipient.trustScore >= 50 && !recipient.revoked;
  const { easyMode } = useEasyMode();
  const guidedStep = sent || isSafe ? 3 : recipient ? 2 : 1;
  const guidedHint = sent
    ? "Done. The app says your payment was sent."
    : isSafe && !sent
      ? "Step three. Type how much money. Tap the big blue send button."
      : recipient && !isSafe
        ? "Stop. This person is not safe to pay. Ask someone you trust before you send money."
        : lookupDone && !recipient
          ? "We do not know this phone on Indentix. Send only if you are sure who they are."
          : "Step one. Put the other person's phone number. Tap Check.";
  const sendOverviewVoice =
    "Send money in three steps. Step one: type their phone and press Check. Step two: read the name and colors. Green is safer. Red means stop. Step three: type the amount and press Send.";

  return (
    <Shell>
      <BackButton onClick={onBack} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#003087] dark:text-sky-400 mb-1">Send Money</h2>
          <p className="text-sm text-slate-500">
            {easyMode ? "Three short steps. Tap the speaker for help." : "Verify the recipient before sending."}
          </p>
        </div>
        {easyMode && <SpeakAloudButton text={sendOverviewVoice} label="Read how sending works" />}
      </div>
      {easyMode && (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/80 p-3 dark:border-sky-900 dark:bg-sky-950/40">
          <SendGuidedDots step={guidedStep} />
          <p className="text-center text-base font-semibold text-slate-800 dark:text-slate-100 leading-snug" role="status">
            {guidedHint}
          </p>
          <div className="mt-2 flex justify-center">
            <SpeakAloudButton text={guidedHint} label="Read this step out loud" />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <PhoneInput
            id="send-recipient-phone"
            label={easyMode ? "Their phone number" : "Recipient phone"}
            value={recipientPhone}
            onChange={(v) => {
              setLookupError(null);
              setRecipientPhone(v);
            }}
            autoComplete="off"
            easyRead={easyMode}
          />
          <Button
            className={`w-full bg-[#003087] hover:bg-[#002060] sm:w-auto sm:min-w-[7rem] ${easyMode ? "h-14 text-base" : "h-11"}`}
            disabled={!hasMinimumNationalDigits(recipientPhone)}
            onClick={() => void lookup()}
          >
            {easyMode ? "Who is this?" : "Check"}
          </Button>
        </div>
        {lookupError && (
          <p className={`text-red-600 ${easyMode ? "text-sm font-medium" : "text-xs"}`}>{lookupError}</p>
        )}

        {lookupDone && !recipient && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className={`font-semibold text-amber-700 ${easyMode ? "text-base" : "text-sm"}`}>
                {easyMode ? "We do not know them" : "Unknown user"}
              </p>
              <p className={`text-amber-600 ${easyMode ? "text-sm mt-1" : "text-xs"}`}>
                {easyMode
                  ? "This number is not in Indentix. Only send if you know the person well."
                  : "Not registered on Indentix. Proceed with caution."}
              </p>
            </div>
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
            {!isSafe && (
              <p className={`text-red-700 mt-2 font-semibold ${easyMode ? "text-sm" : "text-xs"}`}>
                {easyMode ? "Do not pay this person. The red color means danger." : "⚠ Warning: Do not send money to this user."}
              </p>
            )}
          </div>
        )}

        {isSafe && !sent && (
          <div className="space-y-3">
            <label className={`font-medium text-slate-700 dark:text-slate-300 ${easyMode ? "text-lg" : "text-sm"}`}>
              {easyMode ? "How much? (TZS)" : "Amount (TZS)"}
            </label>
            <Input
              className={`text-2xl font-bold text-center ${easyMode ? "h-14 text-3xl" : "h-12"}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button className={`w-full bg-[#003087] hover:bg-[#002060] ${easyMode ? "h-14 text-lg" : "h-12"}`} onClick={() => setSent(true)}>
              <UserCheck className="w-4 h-4 mr-2" />{" "}
              {easyMode ? `Send ${Number(amount).toLocaleString()} shillings` : `Send ${Number(amount).toLocaleString()} TZS`}
            </Button>
          </div>
        )}

        {sent && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-6 text-center">
            <ShieldCheck className="w-10 h-10 text-green-500 mx-auto" aria-hidden />
            <p className="font-bold mt-3 text-lg">{easyMode ? "Money sent!" : "Payment sent!"}</p>
            <p className="text-sm text-slate-500">{easyMode ? `To ${recipient?.name ?? ""}` : `To ${recipient?.name}`}</p>
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
            {me.recoveryEmail && (
              <p className="text-xs text-slate-600 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                Recovery email on file: <span className="font-medium text-slate-800">{me.recoveryEmail}</span>. In production, use it with support to regain access after you secure a new SIM.
              </p>
            )}
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
