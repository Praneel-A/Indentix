/** Small build version, fixed bottom-right on every screen (does not capture pointer events). */
export function AppVersionFooter() {
  return (
    <p
      className="pointer-events-none fixed bottom-2 right-3 z-[55] select-none text-[10px] leading-none text-stone-400 tabular-nums dark:text-slate-500"
      aria-label={`App version ${__APP_VERSION__}`}
    >
      v{__APP_VERSION__}
    </p>
  );
}
