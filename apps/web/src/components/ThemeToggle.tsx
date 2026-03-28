import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/theme";

/** Fixed in the top-right of the centered app column (matches max-w-sm layout). */
export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <div className="fixed top-3 left-0 right-0 z-[60] flex justify-center pointer-events-none">
      <div className="w-full max-w-sm flex justify-end pr-4 pointer-events-auto">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full border-slate-200 bg-white/90 shadow-sm backdrop-blur-sm dark:border-slate-600 dark:bg-slate-800/90"
          onClick={toggle}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
        </Button>
      </div>
    </div>
  );
}
