import { useMemo, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import {
  COUNTRY_DIAL_CODES,
  buildInternationalPhone,
  countryOptionLabel,
  splitInternationalPhone,
} from "@/lib/countryCodes";

type Props = {
  id?: string;
  value: string;
  onChange: (fullInternational: string) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  label?: string;
  autoComplete?: string;
  /** Larger type and controls for simple-help / low-literacy mode */
  easyRead?: boolean;
};

/**
 * Country dial code dropdown + national number. Emits full international string (e.g. +15551234567) for APIs.
 */
export function PhoneInput({
  id,
  value,
  onChange,
  disabled,
  className,
  inputClassName,
  label,
  autoComplete = "tel-national",
  easyRead,
}: Props) {
  const { dial, nationalDigits } = useMemo(() => splitInternationalPhone(value), [value]);

  const onDialChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange(buildInternationalPhone(e.target.value, nationalDigits));
  };

  const onNationalChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(buildInternationalPhone(dial, e.target.value.replace(/\D/g, "")));
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={id}
          className={cn("font-medium text-slate-700 dark:text-slate-300", easyRead ? "text-lg" : "text-sm")}
        >
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <select
          id={id ? `${id}-country` : undefined}
          aria-label="Country calling code"
          disabled={disabled}
          value={dial}
          onChange={onDialChange}
          className={cn(
            easyRead ? "h-14 text-base" : "h-12 text-sm",
            "shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-900 shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "max-w-[min(52%,11rem)] min-w-0 sm:max-w-[13rem]",
          )}
        >
          {COUNTRY_DIAL_CODES.map((c) => (
            <option key={`${c.iso}-${c.dial}`} value={c.dial}>
              {countryOptionLabel(c)}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete={autoComplete}
          placeholder={dial === "+255" ? "7XX XXX XXX" : "Phone number"}
          disabled={disabled}
          value={nationalDigits}
          onChange={onNationalChange}
          className={cn(
            easyRead ? "h-14 text-lg" : "h-12 text-base",
            "min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm",
            "placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
            "disabled:cursor-not-allowed disabled:opacity-50",
            inputClassName,
          )}
        />
      </div>
    </div>
  );
}
