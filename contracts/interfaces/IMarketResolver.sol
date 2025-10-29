// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {IBlindBetMarket} from "./IBlindBetMarket.sol";

/**
 * @title IMarketResolver
 * @notice Interface for market resolution logic
 * @dev Defines who can resolve markets and set outcomes
 */
interface IMarketResolver {

    event ResolverAuthorized(uint256 indexed marketId, address indexed resolver);
    event ResolverRevoked(uint256 indexed marketId, address indexed resolver);
    event OutcomeSet(
        uint256 indexed marketId,
        IBlindBetMarket.Outcome outcome,
        address indexed resolver
    );

    error NotAuthorizedResolver();
    error MarketAlreadyResolved();

    /**
     * @notice Set the resolution outcome for a market
     * @param marketId The market to resolve
     * @param outcome The resolution outcome
     */
    function setResolution(
        uint256 marketId,
        IBlindBetMarket.Outcome outcome
    ) external;

    /**
     * @notice Check if resolver is authorized for a market
     * @param marketId The market ID
     * @param resolver The resolver address
     * @return Whether resolver is authorized
     */
    function isAuthorizedResolver(uint256 marketId, address resolver)
        external
        view
        returns (bool);

    /**
     * @notice Get the authorized resolver for a market
     * @param marketId The market ID
     * @return The resolver address
     */
    function getResolver(uint256 marketId) external view returns (address);
}
