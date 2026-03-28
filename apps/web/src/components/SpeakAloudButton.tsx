import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { speakText, speechSupported } from "@/lib/speech";

type Props = {
  text: string;
  className?: string;
  /** Shorter label for the control itself */
  label?: string;
};

/**
 * Reads `text` aloud using the device TTS. Hidden when the browser does not support speech.
 */
export function SpeakAloudButton({ text, className, label = "Read this out loud" }: Props) {
  if (!speechSupported()) return null;

  return (
    <button
      type="button"
      onClick={() => speakText(text)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 p-2.5 text-sky-800 shadow-sm transition-colors",
        "hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
        className,
      )}
      aria-label={label}
    >
      <Volume2 className="h-5 w-5" aria-hidden />
    </button>
  );
}
