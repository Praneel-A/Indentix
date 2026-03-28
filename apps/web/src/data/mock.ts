import type {
  AgentAction,
  FraudReport,
  IdentityResult,
  MerchantProfile,
  PendingItem,
  Purchase,
} from "@/types";

const now = Date.now();
const h = 3600000;
const d = 86400000;

export const recentReports: FraudReport[] = [
  {
    id: "RPT-1247",
    category: "non_delivery",
    targetPhone: "+255712345678",
    amount: 45000,
    currency: "TZS",
    status: "synced",
    submittedAt: new Date(now - 2 * h),
    syncedAt: new Date(now - 2 * h),
  },
  {
    id: "RPT-1248",
    category: "fake_product",
    targetPhone: "+255754891234",
    amount: 12000,
    currency: "TZS",
    status: "pending_sync",
    submittedAt: new Date(now - 12 * 60000),
    isOffline: true,
  },
  {
    id: "RPT-1245",
    category: "impersonation",
    targetPhone: "+255789001122",
    amount: 78000,
    currency: "TZS",
    status: "synced",
    submittedAt: new Date(now - d),
    syncedAt: new Date(now - d),
  },
  {
    id: "RPT-1244",
    category: "merchant_fraud",
    targetPhone: "+255765334411",
    amount: 150000,
    currency: "TZS",
    status: "failed_sync",
    submittedAt: new Date(now - 5 * h),
    syncedAt: new Date(now - 5 * h),
  },
];

export const identityResults: IdentityResult[] = [
  {
    phone: "+255712345678",
    name: "Juma Kamau",
    riskLevel: "high",
    verificationState: "not_verified",
    reportCount30d: 3,
    totalReports: 12,
    lastSynced: new Date(now - 20 * 60000),
  },
  {
    phone: "+255686441209",
    merchantId: "TZ-MER-00441",
    name: "Amina Kosgei",
    riskLevel: "low",
    verificationState: "verified",
    reportCount30d: 0,
    totalReports: 0,
    lastSynced: new Date(now - 45 * 60000),
    activeSince: "2021-11-14",
  },
  {
    phone: "+255754891234",
    riskLevel: "medium",
    verificationState: "not_verified",
    reportCount30d: 1,
    totalReports: 4,
    lastSynced: new Date(now - 3 * h),
    isFromCache: true,
  },
];

export const merchantProfile: MerchantProfile = {
  id: "TZ-MER-00441",
  name: "Amina K.",
  fullName: "Amina Kosgei",
  phone: "+255686441209",
  verificationState: "verified",
  trustStatus: "good_standing",
  riskLevel: "low",
  reportCount30d: 0,
  totalReports: 0,
  activeSince: "2021-11-14",
  lastActive: new Date(now - 20 * 60000),
  lastSynced: new Date(now - 45 * 60000),
  categories: ["Mobile Accessories", "Electronics"],
};

export const agentActions: AgentAction[] = [
  {
    id: "ACT-0091",
    agentCode: "AGT-DAR-044",
    agentName: "Neema Salumu",
    actionType: "report_submission",
    description: "Fraud report filed with customer present",
    performedAt: new Date(now - 2.1 * h),
    notes: "Customer provided receipt photos. Case forwarded to review queue.",
  },
  {
    id: "ACT-0089",
    agentCode: "AGT-DAR-044",
    agentName: "Neema Salumu",
    actionType: "identity_check",
    description: "Live identity lookup for merchant payment",
    performedAt: new Date(now - 2.3 * h),
  },
  {
    id: "ACT-0082",
    agentCode: "AGT-MWZ-012",
    agentName: "Rashidi Omari",
    actionType: "onboarding",
    description: "New merchant onboarding session completed",
    performedAt: new Date(now - 5 * d),
    notes: "Documents verified. Trust baseline assigned.",
  },
];

export const pendingQueue: PendingItem[] = [
  {
    id: "RPT-1248",
    type: "report",
    description: "Fake product — +255 754 891 234",
    createdAt: new Date(now - 12 * 60000),
  },
  {
    id: "RPT-1249",
    type: "report",
    description: "Suspicious account — +255 765 334 411",
    createdAt: new Date(now - 3 * 60000),
  },
];

export const cachedIdentities: IdentityResult[] = identityResults.map((r) => ({
  ...r,
  isFromCache: true,
  lastSynced: new Date(r.lastSynced.getTime() - 4 * h),
}));

export const recentPurchases: Purchase[] = [
  {
    id: "TXN-8812",
    merchantName: "Juma K.",
    merchantPhone: "+255712345678",
    amount: 45000,
    currency: "TZS",
    method: "mpesa",
    date: new Date(now - 2.5 * h),
    description: "Phone accessories bundle",
  },
  {
    id: "TXN-8809",
    merchantName: "Rashidi Store",
    merchantPhone: "+255754891234",
    amount: 12000,
    currency: "TZS",
    method: "mpesa",
    date: new Date(now - 6 * h),
    description: "USB cable",
  },
  {
    id: "TXN-8803",
    merchantName: "Fatuma M.",
    merchantPhone: "+255789001122",
    amount: 78000,
    currency: "TZS",
    method: "airtel_money",
    date: new Date(now - d),
    description: "Second-hand handset",
  },
  {
    id: "TXN-8798",
    merchantName: "Unknown vendor",
    merchantPhone: "+255765334411",
    amount: 8500,
    currency: "TZS",
    method: "mpesa",
    date: new Date(now - 2 * d),
    description: "Market purchase",
  },
  {
    id: "TXN-8791",
    merchantName: "Kariakoo Electronics",
    merchantPhone: "+255622110034",
    merchantId: "TZ-MER-88201",
    amount: 220000,
    currency: "TZS",
    method: "airtel_money",
    date: new Date(now - 4 * d),
    description: "Bluetooth speaker",
  },
];

export const FRAUD_CATEGORIES = [
  {
    id: "non_delivery" as const,
    label: "Non-delivery",
    description: "Paid but goods or service not received",
  },
  {
    id: "fake_product" as const,
    label: "Fake product",
    description: "Counterfeit or misrepresented item sold",
  },
  {
    id: "merchant_fraud" as const,
    label: "Merchant fraud",
    description: "Overcharging, unauthorized deductions, or scam",
  },
  {
    id: "impersonation" as const,
    label: "Impersonation",
    description: "Someone posing as a legitimate merchant or official",
  },
  {
    id: "suspicious_account" as const,
    label: "Suspicious account",
    description: "Account showing unusual or suspicious behaviour",
  },
];

export function categoryLabel(id: string): string {
  return FRAUD_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
