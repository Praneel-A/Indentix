// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice On-chain mirror of KYC / CDD / EDD outcome. No PII — only tiers and audit hashes.
struct Attestation {
    uint8 kycLevel; // 0 none, 1 basic, 2 standard, 3 EDD cleared
    uint8 riskTier; // 0 low, 1 medium, 2 high (policy-defined off-chain)
    uint64 verifiedAt;
    bytes32 providerAttestationHash;
    bool revoked;
}

/// @title AttestationHub — issuer (backend relayer) sets subject attestations; public read for dApps.
contract AttestationHub {
    address public admin;
    address public issuer;

    mapping(bytes32 subjectId => Attestation) public attestations;

    event IssuerUpdated(address indexed previousIssuer, address indexed newIssuer);
    event AttestationSet(
        bytes32 indexed subjectId,
        uint8 kycLevel,
        uint8 riskTier,
        bytes32 providerAttestationHash,
        uint64 verifiedAt
    );
    event AttestationRevoked(bytes32 indexed subjectId, uint64 timestamp);

    error NotIssuer();
    error NotAdmin();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert NotIssuer();
        _;
    }

    constructor(address admin_, address issuer_) {
        admin = admin_;
        issuer = issuer_;
    }

    function setIssuer(address newIssuer) external onlyAdmin {
        address prev = issuer;
        issuer = newIssuer;
        emit IssuerUpdated(prev, newIssuer);
    }

    function setAttestation(
        bytes32 subjectId,
        uint8 kycLevel,
        uint8 riskTier,
        bytes32 providerAttestationHash
    ) external onlyIssuer {
        uint64 t = uint64(block.timestamp);
        attestations[subjectId] = Attestation({
            kycLevel: kycLevel,
            riskTier: riskTier,
            verifiedAt: t,
            providerAttestationHash: providerAttestationHash,
            revoked: false
        });
        emit AttestationSet(subjectId, kycLevel, riskTier, providerAttestationHash, t);
    }

    function revokeAttestation(bytes32 subjectId) external onlyIssuer {
        attestations[subjectId].revoked = true;
        emit AttestationRevoked(subjectId, uint64(block.timestamp));
    }
}
