// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title FeeManager
 * @notice Utility library for managing fees in encrypted prediction markets
 * @dev Handles fee calculation, distribution, and tracking with FHE operations
 */
library FeeManager {

    error InvalidFeeBasisPoints();
    error InvalidFeeCollector();
    error FeeExceedsAmount();
    error NoFeesToCollect();

    uint256 public constant MAX_FEE_BASIS_POINTS = 1000; // 10%
    uint256 public constant BASIS_POINTS_DIVISOR = 10000; // 100%
    uint256 public constant DEFAULT_FEE_BASIS_POINTS = 200; // 2%

    /**
     * @notice Fee configuration
     */
    struct FeeConfig {
        uint256 feeBasisPoints;
        address feeCollector;
        euint64 totalFeesCollected;
    }

    /**
     * @notice Fee calculation result
     */
    struct FeeCalculation {
        euint64 feeAmount;
        euint64 netAmount;
        euint64 totalAmount;
    }

    /**
     * @notice Calculate fee from encrypted amount
     * @param amount Encrypted total amount
     * @param feeBasisPoints Fee in basis points (e.g., 200 = 2%)
     * @return feeAmount Encrypted fee amount
     */
    function calculateFee(euint64 amount, uint256 feeBasisPoints)
        internal
        returns (euint64 feeAmount)
    {
        if (feeBasisPoints == 0) {
            return FHE.asEuint64(0);
        }

        if (feeBasisPoints > MAX_FEE_BASIS_POINTS) {
            revert InvalidFeeBasisPoints();
        }

        // feeAmount = (amount * feeBasisPoints) / BASIS_POINTS_DIVISOR
        euint64 feeNumerator = FHE.mul(
            amount,
            FHE.asEuint64(uint64(feeBasisPoints))
        );
        feeAmount = FHE.div(feeNumerator, uint64(BASIS_POINTS_DIVISOR));
    }

    /**
     * @notice Calculate fee and net amount
     * @param amount Encrypted total amount
     * @param feeBasisPoints Fee in basis points
     * @return calculation Fee calculation result
     */
    function calculateFeeAndNet(euint64 amount, uint256 feeBasisPoints)
        internal
        returns (FeeCalculation memory calculation)
    {
        calculation.totalAmount = amount;
        calculation.feeAmount = calculateFee(amount, feeBasisPoints);
        calculation.netAmount = FHE.sub(amount, calculation.feeAmount);
    }

    /**
     * @notice Calculate fee from plaintext amount (for display/validation)
     * @param amount Plaintext amount
     * @param feeBasisPoints Fee in basis points
     * @return feeAmount Plaintext fee amount
     */
    function calculateFeePlaintext(uint64 amount, uint256 feeBasisPoints)
        internal
        pure
        returns (uint64 feeAmount)
    {
        if (feeBasisPoints == 0) {
            return 0;
        }

        if (feeBasisPoints > MAX_FEE_BASIS_POINTS) {
            revert InvalidFeeBasisPoints();
        }

        feeAmount = uint64((uint256(amount) * feeBasisPoints) / BASIS_POINTS_DIVISOR);
    }

    /**
     * @notice Extract fee from prize pool
     * @param prizePool Encrypted prize pool
     * @param feeBasisPoints Fee in basis points
     * @return netPool Prize pool after fee extraction
     * @return fee Extracted fee
     */
    function extractFee(euint64 prizePool, uint256 feeBasisPoints)
        internal
        returns (euint64 netPool, euint64 fee)
    {
        fee = calculateFee(prizePool, feeBasisPoints);
        netPool = FHE.sub(prizePool, fee);
    }

    /**
     * @notice Extract fee from multiple pools
     * @param pools Array of encrypted pool amounts
     * @param feeBasisPoints Fee in basis points
     * @return netPools Array of pools after fee extraction
     * @return totalFee Total extracted fees
     */
    function extractFeesFromPools(
        euint64[] memory pools,
        uint256 feeBasisPoints
    ) internal returns (euint64[] memory netPools, euint64 totalFee) {
        netPools = new euint64[](pools.length);
        totalFee = FHE.asEuint64(0);

        for (uint256 i = 0; i < pools.length; i++) {
            euint64 fee = calculateFee(pools[i], feeBasisPoints);
            netPools[i] = FHE.sub(pools[i], fee);
            totalFee = FHE.add(totalFee, fee);
        }
    }

    /**
     * @notice Add fee to total collected fees
     * @param config Fee configuration
     * @param feeAmount Fee amount to add
     */
    function addCollectedFee(FeeConfig storage config, euint64 feeAmount)
        internal
    {
        config.totalFeesCollected = FHE.add(
            config.totalFeesCollected,
            feeAmount
        );
        FHE.allowThis(config.totalFeesCollected);
    }

    /**
     * @notice Reset collected fees (after withdrawal)
     * @param config Fee configuration
     */
    function resetCollectedFees(FeeConfig storage config) internal {
        config.totalFeesCollected = FHE.asEuint64(0);
        FHE.allowThis(config.totalFeesCollected);
    }

    /**
     * @notice Calculate payout with proportional distribution
     * @param userAmount User's encrypted bet amount
     * @return payout User's payout amount
     */
    function calculateProportionalPayout(
        euint64 userAmount,
        euint64 /* totalBetsOnSide */,
        euint64 /* prizePool */
    ) internal pure returns (euint64 payout) {
        // TODO: FHE.div with encrypted divisor is not supported
        // Proper implementation requires:
        // 1. Decryption of pool sizes for precise calculation
        // 2. Alternative approximation algorithms
        // 3. Fixed-point arithmetic with scaling
        //
        // For MVP: Return user amount as minimum guaranteed payout
        payout = userAmount;
    }

    /**
     * @notice Calculate winning payout with fee deduction
     * @param userAmount User's encrypted bet amount on winning side
     * @param totalWinningBets Total bets on winning side
     * @param totalLosingBets Total bets on losing side
     * @param feeBasisPoints Fee in basis points
     * @return payout User's total payout (original bet + winnings)
     */
    function calculateWinningPayout(
        euint64 userAmount,
        euint64 totalWinningBets,
        euint64 totalLosingBets,
        uint256 feeBasisPoints
    ) internal returns (euint64 payout) {
        // Total pool = winning + losing bets
        euint64 totalPool = FHE.add(totalWinningBets, totalLosingBets);

        // Extract fee from total pool
        (euint64 prizePool, ) = extractFee(totalPool, feeBasisPoints);

        // Calculate proportional payout from prize pool
        payout = calculateProportionalPayout(
            userAmount,
            totalWinningBets,
            prizePool
        );
    }

    /**
     * @notice Calculate refund payout (for invalid markets)
     * @param yesAmount User's Yes position
     * @param noAmount User's No position
     * @return refund Total refund amount
     */
    function calculateRefund(euint64 yesAmount, euint64 noAmount)
        internal
        returns (euint64 refund)
    {
        // Refund full amount (both positions) without fees
        refund = FHE.add(yesAmount, noAmount);
    }

    /**
     * @notice Validate fee configuration
     * @param feeBasisPoints Fee in basis points
     * @param feeCollector Fee collector address
     */
    function validateFeeConfig(uint256 feeBasisPoints, address feeCollector)
        internal
        pure
    {
        if (feeBasisPoints > MAX_FEE_BASIS_POINTS) {
            revert InvalidFeeBasisPoints();
        }
        if (feeCollector == address(0)) {
            revert InvalidFeeCollector();
        }
    }

    /**
     * @notice Check if fee collector can withdraw
     * @param config Fee configuration
     * @return canWithdraw Whether fees can be withdrawn
     */
    function canWithdrawFees(FeeConfig storage config)
        internal
        view
        returns (bool canWithdraw)
    {
        // In FHE context, we can't directly check if amount > 0
        // This would need to be handled by the caller with proper decryption
        // or by tracking fee count separately
        return config.feeCollector != address(0);
    }

    /**
     * @notice Calculate effective odds for display
     * @return yesOdds Encrypted Yes odds (scaled by 10000)
     * @return noOdds Encrypted No odds (scaled by 10000)
     */
    function calculateOdds(
        euint64 /* totalYes */,
        euint64 /* totalNo */,
        uint256 /* feeBasisPoints */
    ) internal returns (euint64 yesOdds, euint64 noOdds) {
        // TODO: FHE.div with encrypted divisor not supported
        // Odds calculation requires division which is not available
        // Return placeholder values (1:1 odds = 10000)
        yesOdds = FHE.asEuint64(10000);
        noOdds = FHE.asEuint64(10000);
    }

    /**
     * @notice Calculate expected return for a bet
     * @param betAmount Bet amount
     * @param totalOnSide Current total on that side
     * @param totalOnOtherSide Total on opposite side
     * @param feeBasisPoints Fee in basis points
     * @return expectedReturn Expected return if bet wins
     */
    function calculateExpectedReturn(
        euint64 betAmount,
        euint64 totalOnSide,
        euint64 totalOnOtherSide,
        uint256 feeBasisPoints
    ) internal returns (euint64 expectedReturn) {
        // New total on side after bet
        euint64 newTotalOnSide = FHE.add(totalOnSide, betAmount);

        // Total pool after bet
        euint64 newTotalPool = FHE.add(newTotalOnSide, totalOnOtherSide);

        // Prize pool after fees
        (euint64 prizePool, ) = extractFee(newTotalPool, feeBasisPoints);

        // Expected return = (betAmount / newTotalOnSide) * prizePool
        expectedReturn = calculateProportionalPayout(
            betAmount,
            newTotalOnSide,
            prizePool
        );
    }

    /**
     * @notice Calculate platform revenue from a market
     * @param totalYes Total Yes bets
     * @param totalNo Total No bets
     * @param feeBasisPoints Fee in basis points
     * @return revenue Platform revenue
     */
    function calculatePlatformRevenue(
        euint64 totalYes,
        euint64 totalNo,
        uint256 feeBasisPoints
    ) internal returns (euint64 revenue) {
        euint64 totalPool = FHE.add(totalYes, totalNo);
        revenue = calculateFee(totalPool, feeBasisPoints);
    }
}
