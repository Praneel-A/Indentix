/** Small build version, fixed bottom-right on every screen (does not capture pointer events). */
export function AppVersionFooter() {
  return (
    <p
      className="pointer-events-none fixed bottom-2 right-3 z-[55] select-none text-[10px] leading-none text-slate-400 tabular-nums"
      aria-label={`App version ${__APP_VERSION__}`}
    >
      v{__APP_VERSION__}
    </p>
  );
}
