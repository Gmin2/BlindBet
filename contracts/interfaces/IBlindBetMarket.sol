// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {euint64, ebool, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title IBlindBetMarket
 * @notice Interface for BlindBet prediction markets with encrypted positions
 * @dev All bet amounts and positions remain encrypted using FHE
 */
interface IBlindBetMarket {

    enum MarketState {
        Open,       // Accepting bets
        Locked,     // No more bets, awaiting resolution
        Resolving,  // Decryption in progress
        Resolved    // Settled with winner determined
    }

    enum Outcome {
        NotSet,     // Not yet resolved
        Yes,        // Yes outcome wins
        No,         // No outcome wins
        Invalid     // Market cancelled/invalid
    }

    struct MarketInfo {
        uint256 id;
        string question;
        uint256 createdAt;
        uint256 bettingDeadline;
        uint256 resolutionTime;
        MarketState state;
        Outcome resolvedOutcome;
        address creator;
        address resolver;
    }

    struct EncryptedPosition {
        euint64 yesAmount;
        euint64 noAmount;
        ebool hasPosition;
    }

    event MarketCreated(
        uint256 indexed marketId,
        string question,
        uint256 bettingDeadline,
        uint256 resolutionTime,
        address indexed creator
    );

    event BetPlaced(
        uint256 indexed marketId,
        address indexed user,
        bytes32 encryptedAmountHandle,
        bytes32 encryptedOutcomeHandle,
        uint256 timestamp
    );

    event MarketLocked(uint256 indexed marketId, uint256 timestamp);

    event ResolutionRequested(
        uint256 indexed marketId,
        uint256 requestId,
        uint256 timestamp
    );

    event MarketResolved(
        uint256 indexed marketId,
        Outcome outcome,
        uint256 timestamp
    );

    event WinningsClaimed(
        uint256 indexed marketId,
        address indexed user,
        bytes32 encryptedPayoutHandle,
        uint256 timestamp
    );

    event PoolTotalsDecrypted(
        uint256 indexed marketId,
        uint64 totalYesAmount,
        uint64 totalNoAmount,
        uint256 timestamp
    );

    event FeeCollected(uint256 indexed marketId, bytes32 encryptedFeeAmount);

    error MarketNotFound();
    error MarketNotOpen();
    error MarketNotLocked();
    error MarketNotResolved();
    error BettingDeadlinePassed();
    error InvalidAmount();
    error NoPosition();
    error AlreadyClaimed();
    error InvalidState();
    error Unauthorized();
    error InvalidRequestId();
    error InvalidDuration();
    error InvalidResolver();
    error EmptyQuestion();
    error InvalidQuestion();

    /**
     * @notice Place an encrypted bet on a market
     * @param marketId The market to bet on
     * @param encryptedAmount The encrypted bet amount (externalEuint64)
     * @param encryptedOutcome The encrypted outcome (externalEbool: true = Yes, false = No)
     * @param inputProof The zero-knowledge proof for input verification
     */
    function placeBet(
        uint256 marketId,
        externalEuint64 encryptedAmount,
        externalEbool encryptedOutcome,
        bytes calldata inputProof
    ) external;

    /**
     * @notice Lock market after betting deadline
     * @param marketId The market to lock
     */
    function lockMarket(uint256 marketId) external;

    /**
     * @notice Request resolution via decryption oracle
     * @param marketId The market to resolve
     */
    function requestResolution(uint256 marketId) external;

    /**
     * @notice Claim winnings after market resolution
     * @param marketId The market to claim from
     */
    function claimWinnings(uint256 marketId) external;

    /**
     * @notice Get encrypted position for a user
     * @param marketId The market ID
     * @param user The user address
     * @return yesAmount Encrypted amount bet on Yes
     * @return noAmount Encrypted amount bet on No
     * @return hasPosition Whether user has any position
     */
    function getEncryptedPosition(uint256 marketId, address user)
        external
        view
        returns (
            euint64 yesAmount,
            euint64 noAmount,
            ebool hasPosition
        );

    // Note: The following functions are provided by MarketBase and don't need
    // to be declared in the interface to avoid conflicts:
    // - getMarket(uint256 marketId) returns (MarketInfo memory)
    // - getMarketState(uint256 marketId) returns (MarketState)
    // - hasClaimed(uint256 marketId, address user) returns (bool)
    // - marketCount() returns (uint256) - public state variable
    // - token() returns (address) - public state variable
}
