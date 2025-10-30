// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {IBlindBetMarket} from "../interfaces/IBlindBetMarket.sol";

/**
 * @title MarketLib
 * @notice Library for market-related operations and data structures
 * @dev Provides core market functionality using FHE operations
 */
library MarketLib {

    struct Market {
        uint256 id;
        string question;
        uint256 createdAt;
        uint256 bettingDeadline;
        uint256 resolutionTime;
        uint8 state; // MarketState enum
        uint8 resolvedOutcome; // Outcome enum
        // Encrypted totals
        euint64 totalYesAmount;
        euint64 totalNoAmount;
        euint64 totalVolume;
        // Decrypted totals (stored after oracle callback for payout calculation)
        uint64 decryptedYesAmount;
        uint64 decryptedNoAmount;
        bool totalsDecrypted;
        // Resolution
        uint256 decryptionRequestId;
        bool resolved;
        // Participants
        address creator;
        address resolver;
    }

    struct Position {
        euint64 yesAmount;
        euint64 noAmount;
        ebool exists; // Renamed from hasPosition to avoid naming conflict with checkHasPosition()
        bool claimed;
    }

    uint256 public constant MIN_BETTING_DURATION = 1 hours;
    uint256 public constant MAX_BETTING_DURATION = 365 days;
    uint256 public constant MIN_RESOLUTION_DELAY = 1 hours;
    uint256 public constant MAX_RESOLUTION_DELAY = 30 days;
    uint256 public constant MIN_QUESTION_LENGTH = 10;
    uint256 public constant MAX_QUESTION_LENGTH = 500;

    event MarketStateChanged(uint256 indexed marketId, uint8 newState);

    /**
     * @notice Initialize a new market
     * @param market The market struct to initialize
     * @param id Market ID
     * @param question Market question
     * @param bettingDuration Betting period duration
     * @param resolutionDelay Delay before resolution
     * @param creator Market creator
     * @param resolver Authorized resolver
     */
    function initializeMarket(
        Market storage market,
        uint256 id,
        string memory question,
        uint256 bettingDuration,
        uint256 resolutionDelay,
        address creator,
        address resolver
    ) internal {
        // Validate question length
        uint256 questionLength = bytes(question).length;
        if (questionLength == 0 || questionLength < MIN_QUESTION_LENGTH || questionLength > MAX_QUESTION_LENGTH) {
            revert IBlindBetMarket.InvalidQuestion();
        }

        // Validate betting duration
        if (bettingDuration < MIN_BETTING_DURATION || bettingDuration > MAX_BETTING_DURATION) {
            revert IBlindBetMarket.InvalidDuration();
        }

        // Validate resolution delay
        if (resolutionDelay < MIN_RESOLUTION_DELAY || resolutionDelay > MAX_RESOLUTION_DELAY) {
            revert IBlindBetMarket.InvalidDuration();
        }

        // Validate resolver address
        if (resolver == address(0)) {
            revert IBlindBetMarket.InvalidResolver();
        }

        market.id = id;
        market.question = question;
        market.createdAt = block.timestamp;
        market.bettingDeadline = block.timestamp + bettingDuration;
        market.resolutionTime =
            block.timestamp +
            bettingDuration +
            resolutionDelay;
        market.state = 0; // Open
        market.creator = creator;
        market.resolver = resolver;

        // Initialize encrypted totals to zero
        market.totalYesAmount = FHE.asEuint64(0);
        market.totalNoAmount = FHE.asEuint64(0);
        market.totalVolume = FHE.asEuint64(0);

        // Set ACL permissions for contract
        FHE.allowThis(market.totalYesAmount);
        FHE.allowThis(market.totalNoAmount);
        FHE.allowThis(market.totalVolume);
    }

    /**
     * @notice Update position with new bet
     * @param position The position to update
     * @param amount The bet amount (encrypted)
     * @param isYes Whether bet is on Yes outcome (encrypted)
     * @param userAddress The user's address
     */
    function updatePosition(
        Position storage position,
        euint64 amount,
        ebool isYes,
        address userAddress
    ) internal {
        // Initialize position if first time
        if (!FHE.isInitialized(position.yesAmount)) {
            position.yesAmount = FHE.asEuint64(0);
            FHE.allowThis(position.yesAmount);
        }
        if (!FHE.isInitialized(position.noAmount)) {
            position.noAmount = FHE.asEuint64(0);
            FHE.allowThis(position.noAmount);
        }

        // Update yesAmount: if isYes, add amount, else keep current
        position.yesAmount = FHE.select(
            isYes,
            FHE.add(position.yesAmount, amount),
            position.yesAmount
        );

        // Update noAmount: if NOT isYes, add amount, else keep current
        position.noAmount = FHE.select(
            isYes,
            position.noAmount,
            FHE.add(position.noAmount, amount)
        );

        // Mark as having a position
        position.exists = FHE.asEbool(true);

        // Set ACL permissions
        FHE.allowThis(position.yesAmount);
        FHE.allow(position.yesAmount, userAddress);
        FHE.allowThis(position.noAmount);
        FHE.allow(position.noAmount, userAddress);
        FHE.allowThis(position.exists);
        FHE.allow(position.exists, userAddress);
    }

    /**
     * @notice Update market totals with new bet
     * @param market The market to update
     * @param amount The bet amount (encrypted)
     * @param isYes Whether bet is on Yes outcome (encrypted)
     */
    function updateMarketTotals(
        Market storage market,
        euint64 amount,
        ebool isYes
    ) internal {
        // Update totalYesAmount: if isYes, add amount, else keep current
        market.totalYesAmount = FHE.select(
            isYes,
            FHE.add(market.totalYesAmount, amount),
            market.totalYesAmount
        );

        // Update totalNoAmount: if NOT isYes, add amount, else keep current
        market.totalNoAmount = FHE.select(
            isYes,
            market.totalNoAmount,
            FHE.add(market.totalNoAmount, amount)
        );

        // Always add to total volume
        market.totalVolume = FHE.add(market.totalVolume, amount);

        // Update ACL permissions
        FHE.allowThis(market.totalYesAmount);
        FHE.allowThis(market.totalNoAmount);
        FHE.allowThis(market.totalVolume);
    }

    /**
     * @notice Check if market can accept bets
     * @param market The market to check
     * @return Whether market can accept bets
     */
    function canPlaceBet(Market storage market)
        internal
        view
        returns (bool)
    {
        return market.state == 0 && // Open
            block.timestamp < market.bettingDeadline;
    }

    /**
     * @notice Check if market can be locked
     * @param market The market to check
     * @return Whether market can be locked
     */
    function canLock(Market storage market) internal view returns (bool) {
        return market.state == 0 && // Open
            block.timestamp >= market.bettingDeadline;
    }

    /**
     * @notice Check if market can be resolved
     * @param market The market to check
     * @return Whether market can be resolved
     */
    function canResolve(Market storage market) internal view returns (bool) {
        return market.state == 1 && // Locked
            block.timestamp >= market.resolutionTime;
    }

    /**
     * @notice Lock the market (no more bets allowed)
     * @param market The market to lock
     */
    function lockMarket(Market storage market) internal {
        require(canLock(market), "Cannot lock market");
        market.state = 1; // Locked
        emit MarketStateChanged(market.id, 1);
    }

    /**
     * @notice Set market to resolving state
     * @param market The market
     * @param requestId The decryption request ID
     */
    function startResolving(Market storage market, uint256 requestId)
        internal
    {
        require(canResolve(market), "Cannot resolve market");
        market.state = 2; // Resolving
        market.decryptionRequestId = requestId;
        emit MarketStateChanged(market.id, 2);
    }

    /**
     * @notice Mark market as resolved with decrypted pool totals
     * @param market The market
     * @param outcome The resolved outcome
     * @param decryptedYes Decrypted Yes pool total
     * @param decryptedNo Decrypted No pool total
     */
    function markResolved(
        Market storage market,
        uint8 outcome,
        uint64 decryptedYes,
        uint64 decryptedNo
    ) internal {
        require(market.state == 2, "Market not resolving");
        market.state = 3; // Resolved
        market.resolvedOutcome = outcome;
        market.resolved = true;
        market.decryptedYesAmount = decryptedYes;
        market.decryptedNoAmount = decryptedNo;
        market.totalsDecrypted = true;
        emit MarketStateChanged(market.id, 3);
    }

    /**
     * @notice Check if position has been initialized
     * @param position The position to check
     * @return Whether position exists
     */
    function checkHasPosition(Position storage position)
        internal
        view
        returns (bool)
    {
        return
            FHE.isInitialized(position.yesAmount) ||
            FHE.isInitialized(position.noAmount);
    }
}
