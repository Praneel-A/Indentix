const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

/** Optional recovery email: empty → null; otherwise must look like a real address. */
export function parseRecoveryEmail(raw: unknown): { ok: true; email: string | null } | { ok: false; error: string } {
  if (raw == null || typeof raw !== "string") return { ok: true, email: null };
  const e = raw.trim().toLowerCase();
  if (!e) return { ok: true, email: null };
  if (e.length > 254) return { ok: false, error: "Recovery email is too long." };
  if (!EMAIL_RE.test(e)) return { ok: false, error: "Enter a valid recovery email address." };
  const [local, domain] = e.split("@");
  if (!local || local.length > 64 || !domain?.includes(".")) return { ok: false, error: "Enter a valid recovery email address." };
  return { ok: true, email: e };
}
