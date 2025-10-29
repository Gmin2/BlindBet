// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {MarketLib} from "./MarketLib.sol";

/**
 * @title PayoutCalculator
 * @notice Library for calculating payouts with FHE
 * @dev Handles encrypted payout calculations for different market outcomes
 */
library PayoutCalculator {

    uint64 public constant FEE_BASIS_POINTS = 200; // 2%
    uint64 public constant BASIS_POINTS_DENOMINATOR = 10000;

    /**
     * @notice Calculate payout for a position based on market outcome
     * @param position The user's position
     * @param market The market data
     * @param outcome The resolved outcome (1=Yes, 2=No, 3=Invalid)
     * @return payout The calculated payout amount (encrypted)
     */
    function calculatePayout(
        MarketLib.Position storage position,
        MarketLib.Market storage market,
        uint8 outcome
    ) internal returns (euint64 payout) {
        if (outcome == 3) {
            // Invalid: Refund both positions
            payout = FHE.add(position.yesAmount, position.noAmount);
        } else if (outcome == 1) {
            // Yes wins: Calculate payout for Yes position
            payout = _calculateWinningPayout(
                position.yesAmount,
                market.totalYesAmount,
                market.totalNoAmount
            );
        } else if (outcome == 2) {
            // No wins: Calculate payout for No position
            payout = _calculateWinningPayout(
                position.noAmount,
                market.totalNoAmount,
                market.totalYesAmount
            );
        } else {
            // NotSet: shouldn't happen, return 0
            payout = FHE.asEuint64(0);
        }
    }

    /**
     * @notice Calculate winning payout with proportional share and fee deduction
     * @dev Currently simplified due to FHE division limitations
     * @param userPosition User's position on winning side
     * @return Payout amount after fees
     */
    function _calculateWinningPayout(
        euint64 userPosition,
        euint64 /* totalWinningPool */,
        euint64 /* totalLosingPool */
    ) private pure returns (euint64) {
        // Total pool = winning + losing
        // euint64 totalPool = FHE.add(totalWinningPool, totalLosingPool);

        // Calculate fee: (totalPool * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR
        // euint64 feeAmount = FHE.div(
        //     FHE.mul(totalPool, FHE.asEuint64(FEE_BASIS_POINTS)),
        //     BASIS_POINTS_DENOMINATOR
        // );

        // Prize pool after fee deduction
        // euint64 prizePool = FHE.sub(totalPool, feeAmount); // TODO: Use for proportional payout

        // User gets back their principal
        euint64 principal = userPosition;

        // Calculate share of losing pool
        // share = (userPosition / totalWinningPool) * (prizePool - totalWinningPool)
        // Since FHE division is expensive and we can't do floating point:
        // We approximate: user share ≈ userPosition (minimum guaranteed)

        // For MVP: Return principal only (safe, no loss)
        // TODO: Implement proper proportional payout with fixed-point math
        // payout = principal + (principal * losingPool / winningPool)

        return principal;
    }

    /**
     * @notice Calculate total payout including share of losing pool (advanced)
     * @dev This function is currently not implemented due to FHE limitations
     *      FHE.div only supports plaintext divisors, not encrypted divisors
     *      For now, use calculateSimplePayout which returns principal only
     * @param userPosition User's position on winning side
     * @return Total payout (currently just returns user position as MVP)
     */
    function calculateFullPayout(
        euint64 userPosition,
        euint64 /* totalWinningPool */,
        euint64 /* totalLosingPool */
    ) internal pure returns (euint64) {
        // TODO: Implement proportional payout calculation
        // Current FHE limitations:
        // - FHE.div only works with plaintext divisors (uint64)
        // - Cannot divide euint64 by euint64
        //
        // Possible solutions for future:
        // 1. Use fixed-point arithmetic with scaling factors
        // 2. Request decryption of pool sizes for precise division
        // 3. Use approximation algorithms that avoid division
        //
        // For MVP: Return principal (safe, no loss to users)
        return userPosition;
    }

    /**
     * @notice Calculate fee amount from total pool
     * @param totalPool The total pool size
     * @return Fee amount (encrypted)
     */
    function calculateFee(euint64 totalPool) internal returns (euint64) {
        return
            FHE.div(
                FHE.mul(totalPool, FHE.asEuint64(FEE_BASIS_POINTS)),
                BASIS_POINTS_DENOMINATOR
            );
    }

    /**
     * @notice Check if position has any bets
     * @param position The position to check
     * @return Whether position exists and has value
     */
    function hasPosition(MarketLib.Position storage position)
        internal
        view
        returns (bool)
    {
        // Check if either yesAmount or noAmount is initialized
        bool yesInit = FHE.isInitialized(position.yesAmount);
        bool noInit = FHE.isInitialized(position.noAmount);
        return yesInit || noInit;
    }

    /**
     * @notice Check if user has winning position
     * @param position The user's position
     * @param outcome The market outcome
     * @return hasWinning Whether user has winning position (encrypted)
     */
    function hasWinningPosition(
        MarketLib.Position storage position,
        uint8 outcome
    ) internal returns (ebool hasWinning) {
        if (outcome == 1) {
            // Yes wins: check if yesAmount > 0
            hasWinning = FHE.gt(position.yesAmount, FHE.asEuint64(0));
        } else if (outcome == 2) {
            // No wins: check if noAmount > 0
            hasWinning = FHE.gt(position.noAmount, FHE.asEuint64(0));
        } else if (outcome == 3) {
            // Invalid: everyone with positions gets refund
            hasWinning = FHE.or(
                FHE.gt(position.yesAmount, FHE.asEuint64(0)),
                FHE.gt(position.noAmount, FHE.asEuint64(0))
            );
        } else {
            // NotSet: no winners
            hasWinning = FHE.asEbool(false);
        }
    }

    /**
     * @notice Calculate total pool size for a market
     * @param market The market
     * @return Total pool size (encrypted)
     */
    function getTotalPool(MarketLib.Market storage market)
        internal
        returns (euint64)
    {
        return FHE.add(market.totalYesAmount, market.totalNoAmount);
    }
}
