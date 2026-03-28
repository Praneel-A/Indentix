export type ConnectivityStatus = "online" | "weak" | "offline";
export type RiskLevel = "low" | "medium" | "high" | "unknown";
export type ReportStatus = "synced" | "pending_sync" | "failed_sync" | "draft";
export type FraudCategory =
  | "non_delivery"
  | "fake_product"
  | "merchant_fraud"
  | "impersonation"
  | "suspicious_account";
export type VerificationState = "verified" | "not_verified" | "pending" | "unknown";
export type TrustStatus = "good_standing" | "flagged" | "suspended" | "under_review" | "unknown";

export interface FraudReport {
  id: string;
  category: FraudCategory;
  targetPhone: string;
  targetName?: string;
  targetMerchantId?: string;
  amount?: number;
  currency: string;
  note?: string;
  status: ReportStatus;
  submittedAt: Date;
  syncedAt?: Date;
  isOffline?: boolean;
}

export interface IdentityResult {
  phone: string;
  merchantId?: string;
  name?: string;
  riskLevel: RiskLevel;
  verificationState: VerificationState;
  reportCount30d: number;
  totalReports: number;
  lastSynced: Date;
  activeSince?: string;
  isFromCache?: boolean;
}

export interface MerchantProfile {
  id: string;
  name: string;
  fullName: string;
  phone: string;
  verificationState: VerificationState;
  trustStatus: TrustStatus;
  riskLevel: RiskLevel;
  reportCount30d: number;
  totalReports: number;
  activeSince: string;
  lastActive: Date;
  lastSynced: Date;
  categories: string[];
}

export interface AgentAction {
  id: string;
  agentCode: string;
  agentName: string;
  actionType: "report_submission" | "identity_check" | "onboarding" | "escalation";
  description: string;
  performedAt: Date;
  notes?: string;
}

export interface PendingItem {
  id: string;
  type: "report" | "check";
  description: string;
  createdAt: Date;
}

export interface Purchase {
  id: string;
  merchantName: string;
  merchantPhone: string;
  merchantId?: string;
  amount: number;
  currency: string;
  method: "mpesa" | "airtel_money" | "cash";
  date: Date;
  description: string;
}

export type Screen = "home" | "report" | "check" | "offline" | "agent" | "merchant";
