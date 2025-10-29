// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {IBlindBetMarket} from "../interfaces/IBlindBetMarket.sol";
import {MarketLib} from "../libraries/MarketLib.sol";

/**
 * @title MarketValidator
 * @notice Utility library for validating market parameters and states
 * @dev Provides comprehensive validation logic for market operations
 */
library MarketValidator {

    error EmptyQuestion();
    error QuestionTooLong();
    error InvalidBettingDuration();
    error InvalidResolutionDelay();
    error InvalidResolver();
    error InvalidMarketState();
    error BettingNotOpen();
    error BettingDeadlinePassed();
    error ResolutionTimeNotReached();
    error InvalidAmount();
    error AmountTooSmall();
    error AmountTooLarge();
    error MarketAlreadyResolved();
    error InvalidOutcome();

    uint256 public constant MIN_QUESTION_LENGTH = 10;
    uint256 public constant MAX_QUESTION_LENGTH = 500;
    uint256 public constant MIN_BETTING_DURATION = 1 hours;
    uint256 public constant MAX_BETTING_DURATION = 365 days;
    uint256 public constant MIN_RESOLUTION_DELAY = 1 hours;
    uint256 public constant MAX_RESOLUTION_DELAY = 30 days;
    uint64 public constant MIN_BET_AMOUNT = 1000; // 0.001 cUSDC (6 decimals)
    uint64 public constant MAX_BET_AMOUNT = 1_000_000_000_000; // 1M cUSDC

    /**
     * @notice Validate market creation parameters
     * @param question Market question
     * @param bettingDuration Duration for accepting bets
     * @param resolutionDelay Delay before resolution
     * @param resolver Resolver address
     */
    function validateMarketCreation(
        string memory question,
        uint256 bettingDuration,
        uint256 resolutionDelay,
        address resolver
    ) internal pure {
        // Validate question
        validateQuestion(question);

        // Validate durations
        validateBettingDuration(bettingDuration);
        validateResolutionDelay(resolutionDelay);

        // Validate resolver
        if (resolver == address(0)) revert InvalidResolver();
    }

    /**
     * @notice Validate market question
     * @param question Question to validate
     */
    function validateQuestion(string memory question) internal pure {
        uint256 length = bytes(question).length;

        if (length == 0) revert EmptyQuestion();
        if (length < MIN_QUESTION_LENGTH || length > MAX_QUESTION_LENGTH) {
            revert QuestionTooLong();
        }
    }

    /**
     * @notice Validate betting duration
     * @param duration Duration to validate
     */
    function validateBettingDuration(uint256 duration) internal pure {
        if (duration < MIN_BETTING_DURATION || duration > MAX_BETTING_DURATION)
        {
            revert InvalidBettingDuration();
        }
    }

    /**
     * @notice Validate resolution delay
     * @param delay Delay to validate
     */
    function validateResolutionDelay(uint256 delay) internal pure {
        if (delay < MIN_RESOLUTION_DELAY || delay > MAX_RESOLUTION_DELAY) {
            revert InvalidResolutionDelay();
        }
    }

    /**
     * @notice Validate bet placement
     * @param market Market to validate
     * @param amount Plaintext bet amount (for validation)
     */
    function validateBetPlacement(
        MarketLib.Market storage market,
        uint64 amount
    ) internal view {
        // Check market state
        if (market.state != uint8(IBlindBetMarket.MarketState.Open)) {
            revert BettingNotOpen();
        }

        // Check betting deadline
        if (block.timestamp >= market.bettingDeadline) {
            revert BettingDeadlinePassed();
        }

        // Validate amount
        validateBetAmount(amount);
    }

    /**
     * @notice Validate bet amount
     * @param amount Amount to validate
     */
    function validateBetAmount(uint64 amount) internal pure {
        if (amount == 0) revert InvalidAmount();
        if (amount < MIN_BET_AMOUNT) revert AmountTooSmall();
        if (amount > MAX_BET_AMOUNT) revert AmountTooLarge();
    }

    /**
     * @notice Validate encrypted bet amount (returns encrypted bool)
     * @param amount Encrypted amount
     * @return isValid Encrypted boolean indicating validity
     */
    function validateEncryptedBetAmount(euint64 amount)
        internal
        returns (ebool isValid)
    {
        // Check amount > 0
        ebool isNonZero = FHE.gt(amount, FHE.asEuint64(0));

        // Check amount >= MIN_BET_AMOUNT
        ebool isAboveMin = FHE.ge(amount, FHE.asEuint64(MIN_BET_AMOUNT));

        // Check amount <= MAX_BET_AMOUNT
        ebool isBelowMax = FHE.le(amount, FHE.asEuint64(MAX_BET_AMOUNT));

        // Combine all conditions
        isValid = FHE.and(FHE.and(isNonZero, isAboveMin), isBelowMax);
    }

    /**
     * @notice Validate market can be locked
     * @param market Market to validate
     */
    function validateMarketLocking(MarketLib.Market storage market)
        internal
        view
    {
        // Check market state
        if (market.state != uint8(IBlindBetMarket.MarketState.Open)) {
            revert InvalidMarketState();
        }

        // Check betting deadline has passed
        if (block.timestamp < market.bettingDeadline) {
            revert BettingDeadlinePassed();
        }
    }

    /**
     * @notice Validate market can be resolved
     * @param market Market to validate
     */
    function validateMarketResolution(MarketLib.Market storage market)
        internal
        view
    {
        // Check market state
        if (market.state != uint8(IBlindBetMarket.MarketState.Locked)) {
            revert InvalidMarketState();
        }

        // Check resolution time has been reached
        if (block.timestamp < market.resolutionTime) {
            revert ResolutionTimeNotReached();
        }

        // Check not already resolved
        if (market.resolved) revert MarketAlreadyResolved();
    }

    /**
     * @notice Validate outcome
     * @param outcome Outcome to validate
     */
    function validateOutcome(IBlindBetMarket.Outcome outcome) internal pure {
        if (
            outcome != IBlindBetMarket.Outcome.Yes &&
            outcome != IBlindBetMarket.Outcome.No &&
            outcome != IBlindBetMarket.Outcome.Invalid
        ) {
            revert InvalidOutcome();
        }
    }

    /**
     * @notice Validate winnings can be claimed
     * @param market Market to validate
     * @param position User's position
     */
    function validateWinningsClaim(
        MarketLib.Market storage market,
        MarketLib.Position storage position
    ) internal view {
        // Check market is resolved
        if (!market.resolved) revert MarketAlreadyResolved();

        // Check user has position using the renamed function
        if (!MarketLib.checkHasPosition(position)) {
            revert InvalidMarketState();
        }

        // Check not already claimed
        if (position.claimed) revert MarketAlreadyResolved();
    }

    /**
     * @notice Validate market is in expected state
     * @param market Market to validate
     * @param expectedState Expected state
     */
    function validateMarketState(
        MarketLib.Market storage market,
        IBlindBetMarket.MarketState expectedState
    ) internal view {
        if (market.state != uint8(expectedState)) {
            revert InvalidMarketState();
        }
    }

    /**
     * @notice Check if market is active (accepting bets)
     * @param market Market to check
     * @return isActive Whether market is active
     */
    function isMarketActive(MarketLib.Market storage market)
        internal
        view
        returns (bool isActive)
    {
        return
            market.state == uint8(IBlindBetMarket.MarketState.Open) &&
            block.timestamp < market.bettingDeadline;
    }

    /**
     * @notice Check if market can be locked
     * @param market Market to check
     * @return canLock Whether market can be locked
     */
    function canLockMarket(MarketLib.Market storage market)
        internal
        view
        returns (bool canLock)
    {
        return
            market.state == uint8(IBlindBetMarket.MarketState.Open) &&
            block.timestamp >= market.bettingDeadline;
    }

    /**
     * @notice Check if market can be resolved
     * @param market Market to check
     * @return canResolve Whether market can be resolved
     */
    function canResolveMarket(MarketLib.Market storage market)
        internal
        view
        returns (bool canResolve)
    {
        return
            market.state == uint8(IBlindBetMarket.MarketState.Locked) &&
            block.timestamp >= market.resolutionTime &&
            !market.resolved;
    }

    /**
     * @notice Check if current time is before deadline
     * @param deadline Deadline timestamp
     * @return isBefore Whether current time is before deadline
     */
    function isBeforeDeadline(uint256 deadline)
        internal
        view
        returns (bool isBefore)
    {
        return block.timestamp < deadline;
    }

    /**
     * @notice Check if current time is after deadline
     * @param deadline Deadline timestamp
     * @return isAfter Whether current time is after deadline
     */
    function isAfterDeadline(uint256 deadline)
        internal
        view
        returns (bool isAfter)
    {
        return block.timestamp >= deadline;
    }

    /**
     * @notice Calculate time remaining until deadline
     * @param deadline Deadline timestamp
     * @return timeRemaining Time remaining (0 if past deadline)
     */
    function getTimeRemaining(uint256 deadline)
        internal
        view
        returns (uint256 timeRemaining)
    {
        if (block.timestamp >= deadline) {
            return 0;
        }
        return deadline - block.timestamp;
    }
}
