/** Demo high-risk ISO codes → EDD. Replace with real policy / lists. */
const EDD_COUNTRY_BLOCK = new Set([
  "IRN",
  "PRK",
  "MMR",
  "SYR",
]);

export type RiskTier = 0 | 1 | 2;

export interface CddAssessment {
  riskTier: RiskTier;
  eddRequired: boolean;
}

export function assessCdd(countryCode: string | undefined): CddAssessment {
  const cc = countryCode?.toUpperCase();
  if (cc && EDD_COUNTRY_BLOCK.has(cc)) {
    return { riskTier: 2, eddRequired: true };
  }
  if (cc === "USA" || cc === "GBR") {
    return { riskTier: 1, eddRequired: false };
  }
  return { riskTier: 0, eddRequired: false };
}

/** Map policy to AttestationHub uint8 kycLevel: 0 none, 1 basic, 2 standard, 3 EDD cleared */
export function kycLevelFromState(params: {
  kycApproved: boolean;
  eddRequired: boolean;
  eddApproved: boolean;
}): number {
  if (!params.kycApproved) return 0;
  if (params.eddRequired && !params.eddApproved) return 1;
  if (params.eddRequired && params.eddApproved) return 3;
  return 2;
}
