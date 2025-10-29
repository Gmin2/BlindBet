// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IBlindBetMarket} from "../interfaces/IBlindBetMarket.sol";
import {IConfidentialERC20} from "../interfaces/IConfidentialERC20.sol";
import {MarketLib} from "../libraries/MarketLib.sol";
import {ErrorHandler} from "../libraries/ErrorHandler.sol";

/**
 * @title MarketBase
 * @notice Abstract base contract for prediction markets
 * @dev Provides common functionality, state management, and modifiers
 */
abstract contract MarketBase is
    SepoliaConfig,
    ReentrancyGuard,
    Ownable
{
    using MarketLib for MarketLib.Market;
    using MarketLib for MarketLib.Position;

    /// @notice Payment token for all markets
    IConfidentialERC20 public immutable token;

    /// @notice Markets mapping: marketId => Market
    mapping(uint256 => MarketLib.Market) internal markets;

    /// @notice User positions: marketId => user => Position
    mapping(uint256 => mapping(address => MarketLib.Position))
        internal positions;

    /// @notice Error tracking: user => LastError
    mapping(address => ErrorHandler.LastError) internal userErrors;

    /// @notice Total number of markets created
    uint256 public marketCount;

    /// @notice Collected fees (encrypted handle stored as bytes32)
    bytes32 public collectedFeesHandle;

    /// @notice Pre-initialized error codes
    ErrorHandler.ErrorCodes internal errorCodes;

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        uint256 timestamp
    );

    /**
     * @notice Ensure market exists
     * @param marketId The market ID to check
     */
    modifier marketExists(uint256 marketId) {
        if (marketId >= marketCount) revert IBlindBetMarket.MarketNotFound();
        _;
    }

    /**
     * @notice Ensure market is in required state
     * @param marketId The market ID
     * @param requiredState The required state
     */
    modifier onlyMarketState(
        uint256 marketId,
        IBlindBetMarket.MarketState requiredState
    ) {
        if (markets[marketId].state != uint8(requiredState)) {
            revert IBlindBetMarket.InvalidState();
        }
        _;
    }

    /**
     * @notice Ensure current time is before betting deadline
     * @param marketId The market ID
     */
    modifier onlyBeforeDeadline(uint256 marketId) {
        if (block.timestamp >= markets[marketId].bettingDeadline) {
            revert IBlindBetMarket.BettingDeadlinePassed();
        }
        _;
    }

    /**
     * @notice Ensure current time is after betting deadline
     * @param marketId The market ID
     */
    modifier onlyAfterDeadline(uint256 marketId) {
        if (block.timestamp < markets[marketId].bettingDeadline) {
            revert IBlindBetMarket.InvalidState();
        }
        _;
    }

    /**
     * @notice Ensure current time is after resolution time
     * @param marketId The market ID
     */
    modifier onlyAfterResolutionTime(uint256 marketId) {
        if (block.timestamp < markets[marketId].resolutionTime) {
            revert IBlindBetMarket.InvalidState();
        }
        _;
    }

    /**
     * @notice Ensure caller is market resolver
     * @param marketId The market ID
     */
    modifier onlyResolver(uint256 marketId) {
        if (
            msg.sender != markets[marketId].resolver &&
            msg.sender != owner()
        ) {
            revert IBlindBetMarket.Unauthorized();
        }
        _;
    }

    /**
     * @notice Ensure market is resolved
     * @param marketId The market ID
     */
    modifier onlyResolved(uint256 marketId) {
        if (!markets[marketId].resolved) {
            revert IBlindBetMarket.MarketNotResolved();
        }
        _;
    }

    /**
     * @notice Initialize base contract
     * @param tokenAddress Address of payment token
     */
    constructor(address tokenAddress) Ownable(msg.sender) {
        if (tokenAddress == address(0)) revert IBlindBetMarket.InvalidAmount();
        token = IConfidentialERC20(tokenAddress);

        // Initialize error codes
        _initializeErrorCodes();
    }

    /**
     * @notice Initialize encrypted error codes
     * @dev Called once in constructor
     */
    function _initializeErrorCodes() internal {
        (
            errorCodes.noError,
            errorCodes.insufficientBalance,
            errorCodes.insufficientAllowance,
            errorCodes.invalidAmount,
            errorCodes.marketNotOpen,
            errorCodes.deadlinePassed,
            errorCodes.alreadyClaimed,
            errorCodes.noPosition,
            errorCodes.marketNotResolved
        ) = ErrorHandler.initializeErrors();
    }

    /**
     * @notice Get market by ID
     * @param marketId Market ID
     * @return Market storage reference
     */
    function _getMarket(uint256 marketId)
        internal
        view
        returns (MarketLib.Market storage)
    {
        return markets[marketId];
    }

    /**
     * @notice Get position for user in market
     * @param marketId Market ID
     * @param user User address
     * @return Position storage reference
     */
    function _getPosition(uint256 marketId, address user)
        internal
        view
        returns (MarketLib.Position storage)
    {
        return positions[marketId][user];
    }

    /**
     * @notice Validate market creation parameters
     * @param question Market question
     * @param bettingDuration Duration for betting
     * @param resolutionDelay Delay before resolution
     * @param resolver Resolver address
     */
    function _validateMarketParams(
        string memory question,
        uint256 bettingDuration,
        uint256 resolutionDelay,
        address resolver
    ) internal pure {
        if (bytes(question).length == 0) {
            revert IBlindBetMarket.EmptyQuestion();
        }
        if (
            bettingDuration < MarketLib.MIN_BETTING_DURATION ||
            bettingDuration > MarketLib.MAX_BETTING_DURATION
        ) {
            revert IBlindBetMarket.InvalidDuration();
        }
        if (resolutionDelay < MarketLib.MIN_RESOLUTION_DELAY) {
            revert IBlindBetMarket.InvalidDuration();
        }
        if (resolver == address(0)) {
            revert IBlindBetMarket.InvalidResolver();
        }
    }

    /**
     * @notice Check if user has claimed winnings
     * @param marketId Market ID
     * @param user User address
     * @return Whether user has claimed
     */
    function _hasClaimed(uint256 marketId, address user)
        internal
        view
        returns (bool)
    {
        return positions[marketId][user].claimed;
    }

    /**
     * @notice Mark position as claimed
     * @param marketId Market ID
     * @param user User address
     */
    function _markClaimed(uint256 marketId, address user) internal {
        positions[marketId][user].claimed = true;
    }

    /**
     * @notice Get market information
     * @param marketId The market ID
     * @return Market information struct
     */
    function getMarket(uint256 marketId)
        external
        view
        marketExists(marketId)
        returns (IBlindBetMarket.MarketInfo memory)
    {
        MarketLib.Market storage market = markets[marketId];
        return
            IBlindBetMarket.MarketInfo({
                id: market.id,
                question: market.question,
                createdAt: market.createdAt,
                bettingDeadline: market.bettingDeadline,
                resolutionTime: market.resolutionTime,
                state: IBlindBetMarket.MarketState(market.state),
                resolvedOutcome: IBlindBetMarket.Outcome(
                    market.resolvedOutcome
                ),
                creator: market.creator,
                resolver: market.resolver
            });
    }

    /**
     * @notice Get market state
     * @param marketId The market ID
     * @return Current market state
     */
    function getMarketState(uint256 marketId)
        external
        view
        marketExists(marketId)
        returns (IBlindBetMarket.MarketState)
    {
        return IBlindBetMarket.MarketState(markets[marketId].state);
    }

    /**
     * @notice Check if user has claimed winnings
     * @param marketId The market ID
     * @param user The user address
     * @return Whether winnings have been claimed
     */
    function hasClaimed(uint256 marketId, address user)
        external
        view
        marketExists(marketId)
        returns (bool)
    {
        return _hasClaimed(marketId, user);
    }

    /**
     * @notice Get user's last error
     * @param user User address
     * @return error Encrypted error code
     * @return timestamp When error occurred
     */
    function getLastError(address user)
        external
        view
        returns (bytes32 error, uint256 timestamp)
    {
        ErrorHandler.LastError storage lastError = userErrors[user];
        return (
            bytes32(uint256(uint160(address(uint160(uint256(bytes32(abi.encode(lastError.error)))))))),
            lastError.timestamp
        );
    }
}
