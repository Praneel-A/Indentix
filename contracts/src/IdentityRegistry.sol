// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IdentityRegistry — links EOA wallets to a stable DID commitment (off-chain DID document resolves separately).
contract IdentityRegistry {
    mapping(address => bytes32) public walletToDidHash;

    event WalletLinked(address indexed wallet, bytes32 indexed didHash, uint256 timestamp);

    error AlreadyLinked();

    /// @param didHash keccak256 commitment to the user's DID / root identity document.
    function linkWallet(bytes32 didHash) external {
        if (walletToDidHash[msg.sender] != bytes32(0)) revert AlreadyLinked();
        walletToDidHash[msg.sender] = didHash;
        emit WalletLinked(msg.sender, didHash, block.timestamp);
    }
}
