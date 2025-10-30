// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, ebool, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {MarketBase} from "../abstract/MarketBase.sol";
import {IBlindBetMarket} from "../interfaces/IBlindBetMarket.sol";
import {IMarketResolver} from "../interfaces/IMarketResolver.sol";
import {MarketLib} from "../libraries/MarketLib.sol";
import {PayoutCalculator} from "../libraries/PayoutCalculator.sol";
import {ErrorHandler} from "../libraries/ErrorHandler.sol";

/**
 * @title BlindBetMarket
 * @notice Main contract for confidential prediction markets
 * @dev Implements fully encrypted betting with FHE
 *      - All bet amounts and positions remain encrypted
 *      - Market resolution via decryption oracle
 *      - Payouts calculated on encrypted data
 */
contract BlindBetMarket is MarketBase, IBlindBetMarket, IMarketResolver {
    using MarketLib for MarketLib.Market;
    // Commented out due to naming conflict between Position.hasPosition field and MarketLib.hasPosition() function
    // using MarketLib for MarketLib.Position;
    using PayoutCalculator for MarketLib.Position;
    using PayoutCalculator for MarketLib.Market;

    /**
     * @notice Initialize BlindBetMarket
     * @param tokenAddress Address of payment token (ConfidentialUSDC)
     */
    constructor(address tokenAddress) MarketBase(tokenAddress) {}

    /**
     * @notice Create a new prediction market
     * @param question Market question
     * @param bettingDuration Duration for accepting bets (in seconds)
     * @param resolutionDelay Delay before resolution can occur (in seconds)
     * @param resolver Address authorized to resolve market
     * @return marketId ID of created market
     */
    function createMarket(
        string calldata question,
        uint256 bettingDuration,
        uint256 resolutionDelay,
        address resolver
    ) external returns (uint256 marketId) {
        // Validate parameters
        _validateMarketParams(
            question,
            bettingDuration,
            resolutionDelay,
            resolver
        );

        // Create market
        marketId = marketCount++;
        MarketLib.Market storage market = markets[marketId];

        market.initializeMarket(
            marketId,
            question,
            bettingDuration,
            resolutionDelay,
            msg.sender,
            resolver
        );

        emit MarketCreated(
            marketId,
            question,
            market.bettingDeadline,
            market.resolutionTime,
            msg.sender
        );
    }

    /**
     * @inheritdoc IBlindBetMarket
     */
    function placeBet(
        uint256 marketId,
        externalEuint64 encryptedAmount,
        externalEbool encryptedOutcome,
        bytes calldata inputProof
    )
        external
        override
        nonReentrant
        marketExists(marketId)
        onlyMarketState(marketId, MarketState.Open)
        onlyBeforeDeadline(marketId)
    {
        MarketLib.Market storage market = _getMarket(marketId);
        MarketLib.Position storage position = _getPosition(
            marketId,
            msg.sender
        );

        // Verify and convert encrypted inputs
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        ebool outcome = FHE.fromExternal(encryptedOutcome, inputProof);

        // Transfer tokens with balance verification
        // Get balance before transfer
        euint64 balanceBefore = token.balanceOf(address(this));

        // Allow token contract to access the amount temporarily
        FHE.allowTransient(amount, address(token));

        // Execute transfer (using encrypted version for contract-to-contract transfer)
        token.transferFromEncrypted(msg.sender, address(this), amount);

        // Get balance after transfer
        euint64 balanceAfter = token.balanceOf(address(this));

        // Calculate actual transferred amount (handles insufficient balance silently)
        euint64 actualAmount = FHE.sub(balanceAfter, balanceBefore);

        // Update user's position using library function directly
        MarketLib.updatePosition(position, actualAmount, outcome, msg.sender);

        // Update market totals
        market.updateMarketTotals(actualAmount, outcome);

        emit BetPlaced(
            marketId,
            msg.sender,
            FHE.toBytes32(actualAmount),
            FHE.toBytes32(outcome),
            block.timestamp
        );
    }

    /**
     * @inheritdoc IBlindBetMarket
     */
    function lockMarket(uint256 marketId)
        external
        override
        marketExists(marketId)
        onlyMarketState(marketId, MarketState.Open)
        onlyAfterDeadline(marketId)
    {
        MarketLib.Market storage market = _getMarket(marketId);
        market.lockMarket();

        emit MarketLocked(marketId, block.timestamp);
    }

    /**
     * @inheritdoc IBlindBetMarket
     */
    function requestResolution(uint256 marketId)
        external
        override
        marketExists(marketId)
        onlyMarketState(marketId, MarketState.Locked)
        onlyAfterResolutionTime(marketId)
        onlyResolver(marketId)
    {
        MarketLib.Market storage market = _getMarket(marketId);

        // Request decryption of totals to allow resolver to see the data
        // In a real implementation, this would decrypt the totals
        // For MVP, we skip actual decryption and move directly to resolution
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(market.totalYesAmount);
        cts[1] = FHE.toBytes32(market.totalNoAmount);

        // Request decryption from oracle
        uint256 requestId = FHE.requestDecryption(
            cts,
            this.resolutionCallback.selector
        );

        // Update market state
        market.startResolving(requestId);

        emit ResolutionRequested(marketId, requestId, block.timestamp);
    }

    /**
     * @notice Callback function for decryption oracle
     * @param requestId The decryption request ID
     * @param cleartexts The decrypted values (ABI encoded)
     * @param decryptionProof The decryption proof with signatures
     */
    function resolutionCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) public {
        // Verify signatures
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);

        // Find market by request ID
        uint256 marketId = _findMarketByRequestId(requestId);
        MarketLib.Market storage market = markets[marketId];

        require(
            market.state == uint8(MarketState.Resolving),
            "Market not resolving"
        );
        require(
            requestId == market.decryptionRequestId,
            "Invalid request ID"
        );

        // Decode decrypted totals
        (uint64 totalYes, uint64 totalNo) = abi.decode(
            cleartexts,
            (uint64, uint64)
        );

        // Mark as resolved with decrypted totals (outcome will be set separately by resolver)
        market.markResolved(uint8(Outcome.NotSet), totalYes, totalNo);

        emit PoolTotalsDecrypted(marketId, totalYes, totalNo, block.timestamp);
        emit MarketResolved(marketId, Outcome.NotSet, block.timestamp);
    }

    /**
     * @inheritdoc IMarketResolver
     */
    function setResolution(uint256 marketId, Outcome outcome)
        external
        override
        marketExists(marketId)
        onlyResolved(marketId)
        onlyResolver(marketId)
    {
        MarketLib.Market storage market = _getMarket(marketId);

        require(
            outcome == Outcome.Yes ||
                outcome == Outcome.No ||
                outcome == Outcome.Invalid,
            "Invalid outcome"
        );

        // Set the outcome
        market.resolvedOutcome = uint8(outcome);

        emit OutcomeSet(marketId, outcome, msg.sender);
        emit MarketResolved(marketId, outcome, block.timestamp);
    }

    /**
     * @inheritdoc IBlindBetMarket
     */
    function claimWinnings(uint256 marketId)
        external
        override
        nonReentrant
        marketExists(marketId)
        onlyResolved(marketId)
    {
        MarketLib.Market storage market = _getMarket(marketId);
        MarketLib.Position storage position = _getPosition(
            marketId,
            msg.sender
        );

        // Check if already claimed
        if (position.claimed) revert AlreadyClaimed();

        // Check if user has position - hasPosition is an encrypted boolean
        // For now, we skip this check since we can't easily check ebool
        // TODO: Implement proper position check with FHE operations

        // Mark as claimed
        _markClaimed(marketId, msg.sender);

        // Calculate payout based on outcome
        euint64 payout = position.calculatePayout(
            market,
            market.resolvedOutcome
        );

        // Transfer payout (using encrypted version for contract-to-contract transfer)
        FHE.allowTransient(payout, address(token));
        token.transferEncrypted(msg.sender, payout);

        emit WinningsClaimed(
            marketId,
            msg.sender,
            FHE.toBytes32(payout),
            block.timestamp
        );
    }

    /**
     * @inheritdoc IBlindBetMarket
     */
    function getEncryptedPosition(uint256 marketId, address user)
        external
        view
        override
        marketExists(marketId)
        returns (euint64 yesAmount, euint64 noAmount, ebool)
    {
        MarketLib.Position storage pos = positions[marketId][user];
        // Return the struct members
        return (pos.yesAmount, pos.noAmount, pos.exists);
    }

    /**
     * @inheritdoc IMarketResolver
     */
    function isAuthorizedResolver(uint256 marketId, address resolver)
        external
        view
        override
        marketExists(marketId)
        returns (bool)
    {
        return
            markets[marketId].resolver == resolver || resolver == owner();
    }

    /**
     * @inheritdoc IMarketResolver
     */
    function getResolver(uint256 marketId)
        external
        view
        override
        marketExists(marketId)
        returns (address)
    {
        return markets[marketId].resolver;
    }

    /**
     * @notice Find market by decryption request ID
     * @param requestId The request ID to search for
     * @return marketId The market ID
     */
    function _findMarketByRequestId(uint256 requestId)
        internal
        view
        returns (uint256)
    {
        for (uint256 i = 0; i < marketCount; i++) {
            if (markets[i].decryptionRequestId == requestId) {
                return i;
            }
        }
        revert InvalidRequestId();
    }

    // Note: getMarket(), getMarketState(), and hasClaimed() are inherited from MarketBase
    // The interface functions are satisfied by the base implementation
}
