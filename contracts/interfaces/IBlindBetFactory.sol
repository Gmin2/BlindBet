// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title IBlindBetFactory
 * @notice Interface for BlindBet market factory
 * @dev Factory pattern for deploying and managing multiple prediction markets
 */
interface IBlindBetFactory {

    /**
     * @notice Emitted when a new market is deployed
     * @param marketAddress Address of deployed market contract
     * @param marketId ID of the market
     * @param question Market question
     * @param creator Address of market creator
     */
    event MarketDeployed(
        address indexed marketAddress,
        uint256 indexed marketId,
        string question,
        address indexed creator
    );

    /**
     * @notice Emitted when fee configuration is updated
     * @param oldFeeBps Old fee in basis points
     * @param newFeeBps New fee in basis points
     */
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    /**
     * @notice Emitted when fee collector is updated
     * @param oldCollector Old fee collector address
     * @param newCollector New fee collector address
     */
    event FeeCollectorUpdated(
        address indexed oldCollector,
        address indexed newCollector
    );

    /**
     * @notice Emitted when market implementation is updated
     * @param oldImplementation Old implementation address
     * @param newImplementation New implementation address
     */
    event ImplementationUpdated(
        address indexed oldImplementation,
        address indexed newImplementation
    );

    error InvalidImplementation();
    error InvalidFeeCollector();
    error InvalidFeeBasisPoints();
    error MarketNotFound();
    error InvalidQuestion();
    error InvalidDuration();
    error InvalidResolver();

    /**
     * @notice Market deployment parameters
     */
    struct MarketParams {
        string question;
        uint256 bettingDuration;
        uint256 resolutionDelay;
        address resolver;
    }

    /**
     * @notice Factory configuration
     */
    struct FactoryConfig {
        address implementation;
        address tokenAddress;
        address feeCollector;
        uint256 feeBasisPoints;
        uint256 minBettingDuration;
        uint256 maxBettingDuration;
        uint256 minResolutionDelay;
    }

    /**
     * @notice Deploy a new prediction market
     * @param params Market deployment parameters
     * @return marketAddress Address of deployed market
     * @return marketId ID of the market
     */
    function deployMarket(MarketParams calldata params)
        external
        returns (address marketAddress, uint256 marketId);

    /**
     * @notice Get deployed market address by ID
     * @param marketId Market ID
     * @return marketAddress Address of the market
     */
    function getMarketAddress(uint256 marketId)
        external
        view
        returns (address marketAddress);

    /**
     * @notice Get market ID by address
     * @param marketAddress Address of the market
     * @return marketId Market ID
     */
    function getMarketId(address marketAddress)
        external
        view
        returns (uint256 marketId);

    /**
     * @notice Get total number of deployed markets
     * @return count Total markets
     */
    function getMarketCount() external view returns (uint256 count);

    /**
     * @notice Get factory configuration
     * @return config Factory configuration
     */
    function getConfig() external view returns (FactoryConfig memory config);

    /**
     * @notice Update market implementation (owner only)
     * @param newImplementation New implementation address
     */
    function updateImplementation(address newImplementation) external;

    /**
     * @notice Update fee configuration (owner only)
     * @param newFeeBps New fee in basis points
     */
    function updateFee(uint256 newFeeBps) external;

    /**
     * @notice Update fee collector (owner only)
     * @param newCollector New fee collector address
     */
    function updateFeeCollector(address newCollector) external;
}
