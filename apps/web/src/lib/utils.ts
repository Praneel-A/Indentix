import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "TZS"): string {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

export function formatRelativeTime(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return "yesterday";
  return `${Math.floor(s / 86400)}d ago`;
}

export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length < 9) return phone;
  if (d.startsWith("255") && d.length >= 12) {
    const rest = d.slice(3);
    return `+255 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 9)}`.trim();
  }
  return phone;
}

export function maskPhone(phone: string): string {
  const t = phone.replace(/\s/g, "");
  if (t.length < 10) return phone;
  return `${t.slice(0, 7)}···${t.slice(-3)}`;
}
