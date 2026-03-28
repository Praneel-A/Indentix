import { Home, ShieldCheck, Flag, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Screen } from "@/types";

type Props = {
  current: Screen;
  onNavigate: (s: Screen) => void;
  pendingCount?: number;
};

const tabs: { screen: Screen; label: string; icon: typeof Home }[] = [
  { screen: "home", label: "Home", icon: Home },
  { screen: "check", label: "Check", icon: ShieldCheck },
  { screen: "report", label: "Report", icon: Flag },
  { screen: "offline", label: "Queue", icon: RefreshCw },
];

export function Navigation({ current, onNavigate, pendingCount = 0 }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-[430px] -translate-x-1/2 border-t border-stone-200 bg-white"
      style={{ minHeight: 56 }}
      role="navigation"
      aria-label="Main navigation"
    >
      {tabs.map(({ screen, label, icon: Icon }) => {
        const active = current === screen;
        const showBadge = screen === "offline" && pendingCount > 0;
        return (
          <button
            key={screen}
            type="button"
            onClick={() => onNavigate(screen)}
            className={cn(
              "relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-2",
              active ? "text-stone-900" : "text-stone-400",
            )}
            aria-current={active ? "page" : undefined}
            aria-label={label}
          >
            {active && <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-stone-900" aria-hidden />}
            <span className="relative">
              <Icon className={cn("h-5 w-5", active ? "scale-110" : "")} strokeWidth={active ? 2.5 : 1.75} aria-hidden />
              {showBadge && (
                <span className="absolute -right-1.5 -top-1 flex h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              )}
            </span>
            <span className="text-[10px] font-medium tracking-wide">{label}</span>
            {showBadge && <span className="sr-only">{pendingCount} pending items</span>}
          </button>
        );
      })}
    </nav>
  );
}
