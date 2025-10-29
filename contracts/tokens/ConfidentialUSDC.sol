// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {ConfidentialERC20} from "./ConfidentialERC20.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title ConfidentialUSDC
 * @notice Confidential USDC token for BlindBet markets
 * @dev Wrapper for USDC with encrypted balances
 */
contract ConfidentialUSDC is ConfidentialERC20 {

    /// @notice Initial supply holder
    address public immutable initialSupplyHolder;

    /**
     * @notice Initialize ConfidentialUSDC
     * @param owner Address to receive initial supply
     */
    constructor(address owner) ConfidentialERC20("Confidential USDC", "cUSDC") {
        if (owner == address(0)) revert InvalidAddress();

        initialSupplyHolder = owner;

        // Mint initial supply for testing (1M cUSDC)
        uint64 initialSupply = 1_000_000 * 10 ** 6; // 1M tokens with 6 decimals
        euint64 encryptedSupply = FHE.asEuint64(initialSupply);

        _mint(owner, encryptedSupply);
    }

    /**
     * @notice Mint additional tokens for testing
     * @param to Recipient address
     * @param amount Amount to mint (plaintext)
     * @dev Only for testing purposes
     */
    function mint(address to, uint64 amount) external {
        if (to == address(0)) revert InvalidAddress();

        euint64 encryptedAmount = FHE.asEuint64(amount);
        _mint(to, encryptedAmount);

        emit Mint(to, amount);
    }
}
