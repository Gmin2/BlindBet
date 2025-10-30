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
     * @param market The market data (with decrypted totals)
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
            // Yes wins: Calculate payout for Yes position with proportional profit
            payout = _calculateWinningPayout(
                position.yesAmount,
                market,
                true // isYesWinner
            );
        } else if (outcome == 2) {
            // No wins: Calculate payout for No position with proportional profit
            payout = _calculateWinningPayout(
                position.noAmount,
                market,
                false // isYesWinner
            );
        } else {
            // NotSet: shouldn't happen, return 0
            payout = FHE.asEuint64(0);
        }
    }

    /**
     * @notice Calculate winning payout with proportional share using decrypted pool totals
     * @dev Uses decrypted pool sizes to calculate proportional payout with profit distribution
     * @param userPosition User's position on winning side (encrypted)
     * @param market The market with decrypted totals
     * @param isYesWinner Whether Yes side won
     * @return Payout amount including principal + proportional profit (encrypted)
     */
    function _calculateWinningPayout(
        euint64 userPosition,
        MarketLib.Market storage market,
        bool isYesWinner
    ) private returns (euint64) {
        // Ensure totals have been decrypted
        require(market.totalsDecrypted, "Totals not decrypted");

        uint64 winningPool = isYesWinner ? market.decryptedYesAmount : market.decryptedNoAmount;
        uint64 losingPool = isYesWinner ? market.decryptedNoAmount : market.decryptedYesAmount;

        // If no one bet on winning side or losing side, return principal only
        if (winningPool == 0 || losingPool == 0) {
            return userPosition;
        }

        // Calculate total pool and fee
        uint64 totalPool = winningPool + losingPool;
        uint64 feeAmount = (totalPool * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
        uint64 prizePool = totalPool - feeAmount;

        // Calculate user's share of winning pool as a fraction
        // We use fixed-point arithmetic with 18 decimals for precision
        uint256 PRECISION = 1e18;

        // userShare = (userPosition / winningPool) in fixed-point
        // This represents the user's percentage of the winning pool
        // We calculate: profit = userShare * losingPool

        // First, multiply userPosition by losingPool to get: userPosition * losingPool
        // Then divide by winningPool to get the proportional profit
        // profit = (userPosition * losingPool) / winningPool

        // Calculate profit using encrypted userPosition and plaintext pool sizes
        // profit = FHE.div(FHE.mul(userPosition, losingPool), winningPool)
        euint64 profit = FHE.div(
            FHE.mul(userPosition, FHE.asEuint64(losingPool)),
            winningPool
        );

        // Total payout = principal + profit
        // The profit already accounts for the proportional share, so we just add it to principal
        euint64 payout = FHE.add(userPosition, profit);

        return payout;
    }

    /**
     * @notice Calculate total fee collected for a market
     * @dev Uses decrypted pool totals to calculate accurate fee
     * @param market The market with decrypted totals
     * @return Fee amount (plaintext)
     */
    function calculateMarketFee(MarketLib.Market storage market)
        internal
        view
        returns (uint64)
    {
        require(market.totalsDecrypted, "Totals not decrypted");
        uint64 totalPool = market.decryptedYesAmount + market.decryptedNoAmount;
        return (totalPool * FEE_BASIS_POINTS) / BASIS_POINTS_DENOMINATOR;
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
