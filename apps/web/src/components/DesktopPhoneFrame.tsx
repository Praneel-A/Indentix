import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const DesktopPhoneFramedContext = createContext(false);

/** True when the UI is inside the desktop phone bezel (not full-screen mobile). */
export function useDesktopPhoneFramed(): boolean {
  return useContext(DesktopPhoneFramedContext);
}

/**
 * Desktop / laptop: fine pointer + hover (mouse / trackpad) and a reasonably wide viewport.
 * Touch-first phones and tablets usually report coarse pointer or no hover.
 */
function useShowDesktopPhoneFrame(): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (pointer: fine) and (hover: hover)");
    const sync = () => setShow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return show;
}

/**
 * On laptop/desktop, wraps the app in a centered phone-style frame so the mobile layout
 * does not stretch awkwardly. On real phones, children render full-screen as before.
 */
export function DesktopPhoneFrame({ children }: { children: ReactNode }) {
  const show = useShowDesktopPhoneFrame();

  if (!show) {
    return <DesktopPhoneFramedContext.Provider value={false}>{children}</DesktopPhoneFramedContext.Provider>;
  }

  return (
    <DesktopPhoneFramedContext.Provider value={true}>
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 px-4 py-6 sm:px-8">
        <p className="mb-4 max-w-sm text-center text-[11px] leading-snug text-slate-400">
          Phone layout on your computer. On a real phone, Indentix uses the full screen.
        </p>
        <div
          className="relative flex w-[min(390px,calc(100vw-2rem))] flex-col rounded-[2.75rem] border-[12px] border-zinc-950 bg-zinc-950 shadow-[0_25px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
          style={{ height: "min(90dvh, 852px)" }}
        >
          <div
            className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-6 w-[5.5rem] -translate-x-1/2 rounded-full bg-black"
            aria-hidden
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.85rem] bg-white dark:bg-slate-950">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
          </div>
        </div>
      </div>
    </DesktopPhoneFramedContext.Provider>
  );
}
