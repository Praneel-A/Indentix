import { Accessibility } from "lucide-react";
import { useEasyMode } from "@/context/EasyModeContext";

/**
 * Prominent switch for “simple help” mode: short words, bigger UI hints, read-aloud buttons.
 */
export function EasyModeBanner() {
  const { easyMode, setEasyMode } = useEasyMode();

  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-2xl border-2 p-3.5 ${
        easyMode
          ? "border-amber-400 bg-amber-50"
          : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40"
      }`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          easyMode ? "bg-amber-200 text-amber-900" : "bg-white text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300"
        }`}
        aria-hidden
      >
        <Accessibility className="h-6 w-6" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className={`text-sm font-bold ${easyMode ? "text-amber-950" : "text-slate-800 dark:text-slate-100"}`}>
          Simple help
        </p>
        <p className="mt-0.5 text-xs leading-snug text-slate-600 dark:text-slate-400">
          {easyMode
            ? "Short words, numbered steps, and speaker buttons. Tap Off when you want the normal screen."
            : "Bigger cues, easy steps, and a speaker so the phone can read instructions to you."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={easyMode}
        onClick={() => setEasyMode(!easyMode)}
        className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-wide ${
          easyMode
            ? "bg-amber-600 text-white shadow-sm"
            : "border border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        }`}
      >
        {easyMode ? "On" : "Off"}
      </button>
    </div>
  );
}

/** Compact toggle for the signed-in header (blue bar). */
export function EasyModeHomeChip() {
  const { easyMode, setEasyMode } = useEasyMode();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={easyMode}
      aria-label={easyMode ? "Simple help is on. Tap to turn off." : "Turn on simple help"}
      onClick={() => setEasyMode(!easyMode)}
      className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide border transition-colors ${
        easyMode
          ? "border-amber-200 bg-amber-100 text-amber-950"
          : "border-white/35 bg-white/10 text-white hover:bg-white/20"
      }`}
    >
      {easyMode ? "Simple on" : "Simple help"}
    </button>
  );
}
