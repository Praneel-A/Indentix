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

function id() { return Math.random().toString(36).slice(2, 10); }

const DEMO_USERS: AppUser[] = [
  {
    id: "user_praneel",
    phone: "+14703803242",
    name: "Praneel Anand",
    verified: true,
    faceEmbedding: null,
    faceHash: null,
    faceEnrolledAt: null,
    govIdImage: null,
    govIdUploadedAt: null,
    onboarded: true,
    trustScore: 92,
    trustLevel: "TRUSTED",
    isAgent: false,
    revoked: false,
    revokedAt: null,
    createdAt: "2025-01-15T08:00:00Z",
    transactions: [
      { id: id(), from: "+14703803242", to: "+255787654321", amount: 50000, currency: "TZS", status: "confirmed", timestamp: "2026-03-27T10:30:00Z" },
      { id: id(), from: "+255798888888", to: "+14703803242", amount: 25000, currency: "TZS", status: "confirmed", timestamp: "2026-03-26T14:15:00Z" },
    ],
  },
  {
    id: "user_juma",
    phone: "+255787654321",
    name: "Juma Bakari",
    verified: true,
    faceEmbedding: null,
    faceHash: null,
    faceEnrolledAt: null,
    govIdImage: null,
    govIdUploadedAt: null,
    onboarded: true,
    trustScore: 75,
    trustLevel: "VERIFIED",
    isAgent: false,
    revoked: false,
    revokedAt: null,
    createdAt: "2025-06-01T10:00:00Z",
    transactions: [],
  },
  {
    id: "user_scammer",
    phone: "+255700000000",
    name: "Unknown Caller",
    verified: false,
    faceEmbedding: null,
    faceHash: null,
    faceEnrolledAt: null,
    govIdImage: null,
    govIdUploadedAt: null,
    onboarded: false,
    trustScore: 5,
    trustLevel: "SCAMMER",
    isAgent: false,
    revoked: false,
    revokedAt: null,
    createdAt: "2026-03-20T12:00:00Z",
    transactions: [
      { id: id(), from: "+255700000000", to: "+255712345678", amount: 500000, currency: "TZS", status: "fake", timestamp: "2026-03-27T09:00:00Z" },
    ],
  },
  {
    id: "user_fake_agent",
    phone: "+255711111111",
    name: "M-Pesa Agent (FAKE)",
    verified: false,
    faceEmbedding: null,
    faceHash: null,
    faceEnrolledAt: null,
    govIdImage: null,
    govIdUploadedAt: null,
    onboarded: false,
    trustScore: 12,
    trustLevel: "UNVERIFIED",
    isAgent: true,
    revoked: false,
    revokedAt: null,
    createdAt: "2026-03-25T08:00:00Z",
    transactions: [],
  },
  {
    id: "user_real_agent",
    phone: "+255798888888",
    name: "M-Pesa Agent Kariakoo",
    verified: true,
    faceEmbedding: null,
    faceHash: null,
    faceEnrolledAt: null,
    govIdImage: null,
    govIdUploadedAt: null,
    onboarded: true,
    trustScore: 88,
    trustLevel: "TRUSTED",
    isAgent: true,
    revoked: false,
    revokedAt: null,
    createdAt: "2024-11-01T08:00:00Z",
    transactions: [],
  },
];

class Store {
  users: Map<string, AppUser> = new Map();
  phoneIndex: Map<string, string> = new Map();

  constructor() {
    for (const u of DEMO_USERS) {
      this.users.set(u.id, { ...u });
      this.phoneIndex.set(u.phone, u.id);
    }
  }

  getById(id: string) { return this.users.get(id) ?? null; }
  getByPhone(phone: string) { const uid = this.phoneIndex.get(phone); return uid ? this.users.get(uid) ?? null : null; }

  createUser(phone: string, name: string): AppUser {
    const u: AppUser = {
      id: `user_${id()}`, phone, name, verified: false,
      faceEmbedding: null, faceHash: null, faceEnrolledAt: null,
      govIdImage: null, govIdUploadedAt: null, onboarded: false,
      trustScore: 10, trustLevel: "UNVERIFIED",
      isAgent: false, revoked: false, revokedAt: null,
      createdAt: new Date().toISOString(), transactions: [],
    };
    this.users.set(u.id, u);
    this.phoneIndex.set(u.phone, u.id);
    return u;
  }

  computeTrust(u: AppUser): { score: number; level: AppUser["trustLevel"] } {
    if (u.revoked) return { score: 0, level: "UNVERIFIED" };
    let s = 0;
    if (u.faceHash) s += 25;
    if (u.govIdImage) s += 15;
    if (u.verified) s += 30;
    if (u.isAgent && u.verified) s += 15;
    if (u.transactions.filter(t => t.status === "confirmed").length > 0) s += 15;
    const level: AppUser["trustLevel"] =
      s >= 80 ? "TRUSTED" : s >= 50 ? "VERIFIED" : s >= 25 ? "BASIC" : "UNVERIFIED";
    return { score: Math.min(100, s), level };
  }

  allUsers() { return Array.from(this.users.values()); }
}

export const store = new Store();
