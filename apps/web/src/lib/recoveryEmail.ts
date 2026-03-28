const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

/** Optional on sign-up; if filled, must be a plausible email. */
export function parseRecoveryEmailInput(raw: string): { ok: true; email: string | null } | { ok: false; error: string } {
  const e = raw.trim().toLowerCase();
  if (!e) return { ok: true, email: null };
  if (e.length > 254) return { ok: false, error: "Recovery email is too long." };
  if (!EMAIL_RE.test(e)) return { ok: false, error: "Enter a valid recovery email address." };
  const [local, domain] = e.split("@");
  if (!local || local.length > 64 || !domain?.includes(".")) return { ok: false, error: "Enter a valid recovery email address." };
  return { ok: true, email: e };
}
