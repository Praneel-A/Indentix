import { isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";

/** Validate and normalize to E.164 for storage and lookup. */
export function normalizeAndValidatePhone(raw: string): { ok: true; e164: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) return { ok: false, error: "Phone is required" };
  if (!t.startsWith("+")) {
    return { ok: false, error: "Include your country code (choose country in the dropdown)." };
  }
  try {
    if (!isValidPhoneNumber(t)) {
      return { ok: false, error: "That phone number is not valid for the selected country." };
    }
    const p = parsePhoneNumber(t);
    if (!p?.isValid()) return { ok: false, error: "Invalid phone number." };
    return { ok: true, e164: p.format("E.164") };
  } catch {
    return { ok: false, error: "Invalid phone number." };
  }
}
