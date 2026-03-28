import { supabase } from "./lib/supabase.js";

export interface AppUser {
  id: string;
  phone: string;
  name: string;
  verified: boolean;
  faceEmbedding: number[] | null;
  faceHash: string | null;
  faceEnrolledAt: string | null;
  govIdImage: string | null;
  govIdUploadedAt: string | null;
  onboarded: boolean;
  balance: number;
  trustScore: number;
  trustLevel: "TRUSTED" | "VERIFIED" | "BASIC" | "UNVERIFIED" | "SCAMMER";
  isAgent: boolean;
  revoked: boolean;
  revokedAt: string | null;
  createdAt: string;
  transactions: Transaction[];
}

export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  currency: string;
  status: "confirmed" | "pending" | "fake";
  timestamp: string;
}

function genId() { return Math.random().toString(36).slice(2, 10); }

/* ── DB row <-> AppUser mapping ── */

interface DbRow {
  id: string; phone: string; name: string; verified: boolean;
  face_embedding: number[] | null; face_hash: string | null; face_enrolled_at: string | null;
  gov_id_image: string | null; gov_id_uploaded_at: string | null;
  onboarded: boolean; balance: number;
  trust_score: number; trust_level: string;
  is_agent: boolean; revoked: boolean; revoked_at: string | null;
  transactions: Transaction[]; created_at: string;
}

function rowToUser(r: DbRow): AppUser {
  return {
    id: r.id, phone: r.phone, name: r.name, verified: r.verified,
    faceEmbedding: r.face_embedding, faceHash: r.face_hash, faceEnrolledAt: r.face_enrolled_at,
    govIdImage: r.gov_id_image, govIdUploadedAt: r.gov_id_uploaded_at,
    onboarded: r.onboarded, balance: Number(r.balance),
    trustScore: r.trust_score, trustLevel: r.trust_level as AppUser["trustLevel"],
    isAgent: r.is_agent, revoked: r.revoked, revokedAt: r.revoked_at,
    createdAt: r.created_at, transactions: r.transactions ?? [],
  };
}

function userToRow(u: Partial<AppUser> & { id: string }): Record<string, unknown> {
  const row: Record<string, unknown> = { id: u.id };
  if (u.phone !== undefined) row.phone = u.phone;
  if (u.name !== undefined) row.name = u.name;
  if (u.verified !== undefined) row.verified = u.verified;
  if (u.faceEmbedding !== undefined) row.face_embedding = u.faceEmbedding;
  if (u.faceHash !== undefined) row.face_hash = u.faceHash;
  if (u.faceEnrolledAt !== undefined) row.face_enrolled_at = u.faceEnrolledAt;
  if (u.govIdImage !== undefined) row.gov_id_image = u.govIdImage;
  if (u.govIdUploadedAt !== undefined) row.gov_id_uploaded_at = u.govIdUploadedAt;
  if (u.onboarded !== undefined) row.onboarded = u.onboarded;
  if (u.balance !== undefined) row.balance = u.balance;
  if (u.trustScore !== undefined) row.trust_score = u.trustScore;
  if (u.trustLevel !== undefined) row.trust_level = u.trustLevel;
  if (u.isAgent !== undefined) row.is_agent = u.isAgent;
  if (u.revoked !== undefined) row.revoked = u.revoked;
  if (u.revokedAt !== undefined) row.revoked_at = u.revokedAt;
  if (u.transactions !== undefined) row.transactions = u.transactions;
  if (u.createdAt !== undefined) row.created_at = u.createdAt;
  return row;
}

/* ── In-memory fallback (for local dev without Supabase) ── */

const DEMO_USERS: AppUser[] = [
  { id: "user_praneel", phone: "+14703803242", name: "Praneel Anand", verified: true, faceEmbedding: null, faceHash: null, faceEnrolledAt: null, govIdImage: null, govIdUploadedAt: null, onboarded: true, balance: 1250000, trustScore: 92, trustLevel: "TRUSTED", isAgent: false, revoked: false, revokedAt: null, createdAt: "2025-01-15T08:00:00Z", transactions: [
    { id: "tx1", from: "+14703803242", to: "+255787654321", amount: 50000, currency: "TZS", status: "confirmed", timestamp: "2026-03-27T10:30:00Z" },
    { id: "tx2", from: "+255798888888", to: "+14703803242", amount: 25000, currency: "TZS", status: "confirmed", timestamp: "2026-03-26T14:15:00Z" },
    { id: "tx3", from: "+14703803242", to: "+255798888888", amount: 150000, currency: "TZS", status: "confirmed", timestamp: "2026-03-25T09:00:00Z" },
    { id: "tx4", from: "+255787654321", to: "+14703803242", amount: 75000, currency: "TZS", status: "confirmed", timestamp: "2026-03-24T16:45:00Z" },
    { id: "tx5", from: "+14703803242", to: "+255787654321", amount: 30000, currency: "TZS", status: "pending", timestamp: "2026-03-27T11:00:00Z" },
  ] },
  { id: "user_juma", phone: "+255787654321", name: "Juma Bakari", verified: true, faceEmbedding: null, faceHash: null, faceEnrolledAt: null, govIdImage: null, govIdUploadedAt: null, onboarded: true, balance: 340000, trustScore: 75, trustLevel: "VERIFIED", isAgent: false, revoked: false, revokedAt: null, createdAt: "2025-06-01T10:00:00Z", transactions: [] },
  { id: "user_scammer", phone: "+255700000000", name: "Unknown Caller", verified: false, faceEmbedding: null, faceHash: null, faceEnrolledAt: null, govIdImage: null, govIdUploadedAt: null, onboarded: false, balance: 0, trustScore: 5, trustLevel: "SCAMMER", isAgent: false, revoked: false, revokedAt: null, createdAt: "2026-03-20T12:00:00Z", transactions: [{ id: "tx6", from: "+255700000000", to: "+14703803242", amount: 500000, currency: "TZS", status: "fake", timestamp: "2026-03-27T09:00:00Z" }] },
  { id: "user_fake_agent", phone: "+255711111111", name: "M-Pesa Agent (FAKE)", verified: false, faceEmbedding: null, faceHash: null, faceEnrolledAt: null, govIdImage: null, govIdUploadedAt: null, onboarded: false, balance: 50000, trustScore: 12, trustLevel: "UNVERIFIED", isAgent: true, revoked: false, revokedAt: null, createdAt: "2026-03-25T08:00:00Z", transactions: [] },
  { id: "user_real_agent", phone: "+255798888888", name: "M-Pesa Agent Kariakoo", verified: true, faceEmbedding: null, faceHash: null, faceEnrolledAt: null, govIdImage: null, govIdUploadedAt: null, onboarded: true, balance: 5600000, trustScore: 88, trustLevel: "TRUSTED", isAgent: true, revoked: false, revokedAt: null, createdAt: "2024-11-01T08:00:00Z", transactions: [] },
];

class MemStore {
  users = new Map<string, AppUser>();
  phoneIdx = new Map<string, string>();
  constructor() { for (const u of DEMO_USERS) { this.users.set(u.id, { ...u }); this.phoneIdx.set(u.phone, u.id); } }
}
const mem = new MemStore();

/* ── Exported store (async, works with Supabase or falls back to memory) ── */

export const store = {
  async getById(id: string): Promise<AppUser | null> {
    if (!supabase) return mem.users.get(id) ?? null;
    const { data } = await supabase.from("users").select("*").eq("id", id).single();
    return data ? rowToUser(data as DbRow) : null;
  },

  async getByPhone(phone: string): Promise<AppUser | null> {
    if (!supabase) { const uid = mem.phoneIdx.get(phone); return uid ? mem.users.get(uid) ?? null : null; }
    const { data } = await supabase.from("users").select("*").eq("phone", phone).single();
    return data ? rowToUser(data as DbRow) : null;
  },

  async createUser(phone: string, name: string): Promise<AppUser> {
    const u: AppUser = {
      id: `user_${genId()}`, phone, name, verified: false,
      faceEmbedding: null, faceHash: null, faceEnrolledAt: null,
      govIdImage: null, govIdUploadedAt: null, onboarded: false,
      balance: 0, trustScore: 10, trustLevel: "UNVERIFIED",
      isAgent: false, revoked: false, revokedAt: null,
      createdAt: new Date().toISOString(), transactions: [],
    };
    if (!supabase) { mem.users.set(u.id, u); mem.phoneIdx.set(u.phone, u.id); return u; }
    await supabase.from("users").insert(userToRow(u));
    return u;
  },

  async updateUser(id: string, fields: Partial<AppUser>): Promise<AppUser | null> {
    if (!supabase) {
      const u = mem.users.get(id);
      if (!u) return null;
      Object.assign(u, fields);
      return u;
    }
    const row = userToRow({ id, ...fields });
    delete row.id;
    await supabase.from("users").update(row).eq("id", id);
    return this.getById(id);
  },

  computeTrust(u: AppUser): { score: number; level: AppUser["trustLevel"] } {
    if (u.revoked) return { score: 0, level: "UNVERIFIED" };
    let s = 0;
    if (u.faceHash) s += 25;
    if (u.govIdImage) s += 15;
    if (u.verified) s += 30;
    if (u.isAgent && u.verified) s += 15;
    if ((u.transactions ?? []).filter(t => t.status === "confirmed").length > 0) s += 15;
    const level: AppUser["trustLevel"] = s >= 80 ? "TRUSTED" : s >= 50 ? "VERIFIED" : s >= 25 ? "BASIC" : "UNVERIFIED";
    return { score: Math.min(100, s), level };
  },

  async allUsers(): Promise<AppUser[]> {
    if (!supabase) return Array.from(mem.users.values());
    const { data } = await supabase.from("users").select("*").order("created_at", { ascending: true });
    return (data ?? []).map((r) => rowToUser(r as DbRow));
  },

  async seedDemoUsers(): Promise<number> {
    if (!supabase) return 0;
    let count = 0;
    for (const u of DEMO_USERS) {
      const existing = await this.getById(u.id);
      if (!existing) {
        await supabase.from("users").insert(userToRow(u));
        count++;
      }
    }
    return count;
  },
};
