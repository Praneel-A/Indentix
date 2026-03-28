/** ISO2, English name, E.164 prefix (no trunk 0). Order: common for this app, then alphabetical. */
export const COUNTRY_DIAL_CODES: { iso: string; name: string; dial: string }[] = [
  { iso: "TZ", name: "Tanzania", dial: "+255" },
  { iso: "US", name: "United States / Canada", dial: "+1" },
  { iso: "KE", name: "Kenya", dial: "+254" },
  { iso: "UG", name: "Uganda", dial: "+256" },
  { iso: "RW", name: "Rwanda", dial: "+250" },
  { iso: "ZA", name: "South Africa", dial: "+27" },
  { iso: "NG", name: "Nigeria", dial: "+234" },
  { iso: "ET", name: "Ethiopia", dial: "+251" },
  { iso: "EG", name: "Egypt", dial: "+20" },
  { iso: "GH", name: "Ghana", dial: "+233" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971" },
  { iso: "AU", name: "Australia", dial: "+61" },
  { iso: "BR", name: "Brazil", dial: "+55" },
  { iso: "CN", name: "China", dial: "+86" },
  { iso: "DE", name: "Germany", dial: "+49" },
  { iso: "FR", name: "France", dial: "+33" },
  { iso: "GB", name: "United Kingdom", dial: "+44" },
  { iso: "IN", name: "India", dial: "+91" },
  { iso: "JM", name: "Jamaica", dial: "+1876" },
  { iso: "MX", name: "Mexico", dial: "+52" },
];

export const DEFAULT_DIAL = "+255";

function flagEmoji(iso: string): string {
  if (iso.length !== 2) return "🌐";
  const u = iso.toUpperCase();
  return String.fromCodePoint(...[...u].map((c) => 127397 + c.charCodeAt(0)));
}

export function countryOptionLabel(c: { iso: string; name: string; dial: string }): string {
  return `${flagEmoji(c.iso)} ${c.dial} ${c.name}`;
}

/** Digits only after + for matching. */
function dialDigits(dial: string): string {
  return dial.replace(/\D/g, "");
}

/** Split stored E.164-ish string into dial + national digits. */
export function splitInternationalPhone(full: string): { dial: string; nationalDigits: string } {
  const digits = full.replace(/\D/g, "");
  if (!digits) return { dial: DEFAULT_DIAL, nationalDigits: "" };

  const sorted = [...COUNTRY_DIAL_CODES].sort((a, b) => dialDigits(b.dial).length - dialDigits(a.dial).length);
  for (const c of sorted) {
    const dd = dialDigits(c.dial);
    if (digits.startsWith(dd)) {
      return { dial: c.dial, nationalDigits: digits.slice(dd.length) };
    }
  }
  return { dial: DEFAULT_DIAL, nationalDigits: digits };
}

/** Normalize dial to leading + form. */
function normalizeDial(dial: string): string {
  return dial.startsWith("+") ? dial : `+${dial.replace(/\D/g, "")}`;
}

/**
 * Build stored value for the phone field. If there are no national digits yet, still return the
 * selected dial (e.g. "+1") so changing country in the dropdown is not overwritten by the default +255.
 */
export function buildInternationalPhone(dial: string, nationalDigits: string): string {
  const n = nationalDigits.replace(/\D/g, "");
  const d = normalizeDial(dial);
  if (!n) return d;
  return `${d}${n}`;
}

/** True if user entered enough national digits to attempt lookup/login (not just a country code). */
export function hasMinimumNationalDigits(phone: string, minDigits = 7): boolean {
  return splitInternationalPhone(phone).nationalDigits.replace(/\D/g, "").length >= minDigits;
}
