export const attestationHubAbi = [
  {
    type: "function",
    name: "setAttestation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "subjectId", type: "bytes32" },
      { name: "kycLevel", type: "uint8" },
      { name: "riskTier", type: "uint8" },
      { name: "providerAttestationHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "attestations",
    stateMutability: "view",
    inputs: [{ name: "subjectId", type: "bytes32" }],
    outputs: [
      { name: "kycLevel", type: "uint8" },
      { name: "riskTier", type: "uint8" },
      { name: "verifiedAt", type: "uint64" },
      { name: "providerAttestationHash", type: "bytes32" },
      { name: "revoked", type: "bool" },
    ],
  },
] as const;
