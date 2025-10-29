// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BlindBetMarket} from "./BlindBetMarket.sol";
import {IBlindBetFactory} from "../interfaces/IBlindBetFactory.sol";
import {IConfidentialERC20} from "../interfaces/IConfidentialERC20.sol";

/**
 * @title BlindBetFactory
 * @notice Factory contract for deploying BlindBet prediction markets
 * @dev Implements factory pattern for efficient market deployment and management
 */
contract BlindBetFactory is IBlindBetFactory, Ownable {
    
    /// @notice Address of BlindBetMarket implementation
    address public implementation;

    /// @notice Address of payment token (ConfidentialUSDC)
    address public tokenAddress;

    /// @notice Fee collector address
    address public feeCollector;

    /// @notice Fee in basis points (100 = 1%)
    uint256 public feeBasisPoints;

    /// @notice Minimum betting duration (in seconds)
    uint256 public minBettingDuration;

    /// @notice Maximum betting duration (in seconds)
    uint256 public maxBettingDuration;

    /// @notice Minimum resolution delay (in seconds)
    uint256 public minResolutionDelay;

    /// @notice Total number of deployed markets
    uint256 public marketCount;

    /// @notice Mapping: marketId => market address
    mapping(uint256 => address) public markets;

    /// @notice Mapping: market address => marketId
    mapping(address => uint256) public marketIds;

    uint256 public constant MAX_FEE_BASIS_POINTS = 1000; // 10% max fee
    uint256 public constant MIN_BETTING_DURATION = 1 hours;
    uint256 public constant MAX_BETTING_DURATION = 365 days;
    uint256 public constant MIN_RESOLUTION_DELAY = 1 hours;

    /**
     * @notice Initialize the factory
     * @param _tokenAddress Address of payment token (ConfidentialUSDC)
     * @param _feeCollector Initial fee collector address
     * @param _feeBasisPoints Initial fee in basis points
     */
    constructor(
        address _tokenAddress,
        address _feeCollector,
        uint256 _feeBasisPoints
    ) Ownable(msg.sender) {
        if (_tokenAddress == address(0)) revert InvalidImplementation();
        if (_feeCollector == address(0)) revert InvalidFeeCollector();
        if (_feeBasisPoints > MAX_FEE_BASIS_POINTS)
            revert InvalidFeeBasisPoints();

        tokenAddress = _tokenAddress;
        feeCollector = _feeCollector;
        feeBasisPoints = _feeBasisPoints;

        // Set default parameters
        minBettingDuration = MIN_BETTING_DURATION;
        maxBettingDuration = MAX_BETTING_DURATION;
        minResolutionDelay = MIN_RESOLUTION_DELAY;
    }

    /**
     * @inheritdoc IBlindBetFactory
     */
    function deployMarket(MarketParams calldata params)
        external
        override
        returns (address marketAddress, uint256 marketId)
    {
        // Validate parameters
        _validateMarketParams(params);

        // Create new market ID
        marketId = marketCount++;

        // Deploy new market contract
        BlindBetMarket market = new BlindBetMarket(tokenAddress);

        marketAddress = address(market);

        // Store mappings
        markets[marketId] = marketAddress;
        marketIds[marketAddress] = marketId;

        // Create market
        market.createMarket(
            params.question,
            params.bettingDuration,
            params.resolutionDelay,
            params.resolver
        );

        emit MarketDeployed(
            marketAddress,
            marketId,
            params.question,
            msg.sender
        );
    }

    /**
     * @inheritdoc IBlindBetFactory
     */
    function getMarketAddress(uint256 marketId)
        external
        view
        override
        returns (address marketAddress)
    {
        marketAddress = markets[marketId];
        if (marketAddress == address(0)) revert MarketNotFound();
    }

    /**
     * @inheritdoc IBlindBetFactory
     */
    function getMarketId(address marketAddress)
        external
        view
        override
        returns (uint256 marketId)
    {
        marketId = marketIds[marketAddress];
        if (markets[marketId] != marketAddress) revert MarketNotFound();
    }

    /**
     * @inheritdoc IBlindBetFactory
     */
    function getMarketCount() external view override returns (uint256 count) {
        return marketCount;
    }

    /**
     * @inheritdoc IBlindBetFactory
     */
    function getConfig()
        external
        view
        override
        returns (FactoryConfig memory config)
    {
        return
            FactoryConfig({
                implementation: implementation,
                tokenAddress: tokenAddress,
                feeCollector: feeCollector,
                feeBasisPoints: feeBasisPoints,
                minBettingDuration: minBettingDuration,
                maxBettingDuration: maxBettingDuration,
                minResolutionDelay: minResolutionDelay
            });
    }

    /**
     * @inheritdoc IBlindBetFactory
     */
    function updateImplementation(address newImplementation)
        external
        override
        onlyOwner
    {
        if (newImplementation == address(0)) revert InvalidImplementation();

        address oldImplementation = implementation;
        implementation = newImplementation;

        emit ImplementationUpdated(oldImplementation, newImplementation);
    }

    /**
     * @inheritdoc IBlindBetFactory
     */
    function updateFee(uint256 newFeeBps) external override onlyOwner {
        if (newFeeBps > MAX_FEE_BASIS_POINTS) revert InvalidFeeBasisPoints();

        uint256 oldFeeBps = feeBasisPoints;
        feeBasisPoints = newFeeBps;

        emit FeeUpdated(oldFeeBps, newFeeBps);
    }

    /**
     * @inheritdoc IBlindBetFactory
     */
    function updateFeeCollector(address newCollector)
        external
        override
        onlyOwner
    {
        if (newCollector == address(0)) revert InvalidFeeCollector();

        address oldCollector = feeCollector;
        feeCollector = newCollector;

        emit FeeCollectorUpdated(oldCollector, newCollector);
    }

    /**
     * @notice Validate market deployment parameters
     * @param params Market parameters to validate
     */
    function _validateMarketParams(MarketParams calldata params)
        internal
        view
    {
        if (bytes(params.question).length == 0) revert InvalidQuestion();
        if (
            params.bettingDuration < minBettingDuration ||
            params.bettingDuration > maxBettingDuration
        ) revert InvalidDuration();
        if (params.resolutionDelay < minResolutionDelay)
            revert InvalidDuration();
        if (params.resolver == address(0)) revert InvalidResolver();
    }
}
