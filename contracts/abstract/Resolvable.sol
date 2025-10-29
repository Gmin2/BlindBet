// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IMarketResolver} from "../interfaces/IMarketResolver.sol";
import {IBlindBetMarket} from "../interfaces/IBlindBetMarket.sol";

/**
 * @title Resolvable
 * @notice Abstract contract providing resolution logic for prediction markets
 * @dev Handles oracle decryption, outcome setting, and resolution verification
 */
abstract contract Resolvable is IMarketResolver {

    error InvalidOutcome();
    error AlreadyResolved();
    error NotInResolvingState();
    error InvalidDecryptionRequest();
    error UnauthorizedResolver();

    event DecryptionRequested(
        uint256 indexed marketId,
        uint256 indexed requestId,
        uint256 timestamp
    );

    event DecryptionCompleted(
        uint256 indexed marketId,
        uint256 indexed requestId,
        uint256 timestamp
    );

    event OutcomeProposed(
        uint256 indexed marketId,
        IBlindBetMarket.Outcome proposedOutcome,
        address indexed proposer
    );

    /// @notice Mapping: requestId => marketId
    mapping(uint256 => uint256) internal requestIdToMarketId;

    /// @notice Mapping: marketId => decrypted totals available
    mapping(uint256 => bool) internal decryptionCompleted;

    /// @notice Mapping: marketId => decrypted Yes total
    mapping(uint256 => uint64) internal decryptedYesTotal;

    /// @notice Mapping: marketId => decrypted No total
    mapping(uint256 => uint64) internal decryptedNoTotal;

    /**
     * @notice Ensure caller is authorized resolver for the market
     * @param marketId Market ID to check
     */
    modifier onlyAuthorizedResolver(uint256 marketId) {
        if (!isAuthorizedResolver(marketId, msg.sender)) {
            revert UnauthorizedResolver();
        }
        _;
    }

    /**
     * @notice Request decryption of market totals
     * @param marketId Market ID
     * @param totalYesAmount Encrypted Yes total
     * @param totalNoAmount Encrypted No total
     * @return requestId Decryption request ID
     */
    function _requestDecryption(
        uint256 marketId,
        euint64 totalYesAmount,
        euint64 totalNoAmount
    ) internal returns (uint256 requestId) {
        // Prepare ciphertexts for decryption
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(totalYesAmount);
        cts[1] = FHE.toBytes32(totalNoAmount);

        // Request decryption from oracle
        requestId = FHE.requestDecryption(
            cts,
            this.handleDecryptionCallback.selector
        );

        // Store mapping
        requestIdToMarketId[requestId] = marketId;

        emit DecryptionRequested(marketId, requestId, block.timestamp);
    }

    /**
     * @notice Callback function for decryption oracle
     * @param requestId The decryption request ID
     * @param cleartexts The decrypted values (ABI encoded)
     * @param decryptionProof The decryption proof with signatures
     */
    function handleDecryptionCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) public virtual {
        // Verify signatures from decryption oracle
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);

        // Get market ID from request
        uint256 marketId = requestIdToMarketId[requestId];
        if (marketId == 0 && requestId != 0) {
            revert InvalidDecryptionRequest();
        }

        // Decode decrypted totals
        (uint64 totalYes, uint64 totalNo) = abi.decode(
            cleartexts,
            (uint64, uint64)
        );

        // Store decrypted values
        decryptedYesTotal[marketId] = totalYes;
        decryptedNoTotal[marketId] = totalNo;
        decryptionCompleted[marketId] = true;

        emit DecryptionCompleted(marketId, requestId, block.timestamp);

        // Call hook for subclasses to handle completion
        _onDecryptionCompleted(marketId, totalYes, totalNo);
    }

    /**
     * @notice Hook called when decryption is completed
     * @param marketId Market ID
     * @param totalYes Decrypted Yes total
     * @param totalNo Decrypted No total
     * @dev Override in derived contracts to implement custom logic
     */
    function _onDecryptionCompleted(
        uint256 marketId,
        uint64 totalYes,
        uint64 totalNo
    ) internal virtual {}

    /**
     * @notice Validate outcome before setting
     * @param outcome Outcome to validate
     * @return isValid Whether outcome is valid
     */
    function _validateOutcome(IBlindBetMarket.Outcome outcome)
        internal
        pure
        returns (bool isValid)
    {
        return
            outcome == IBlindBetMarket.Outcome.Yes ||
            outcome == IBlindBetMarket.Outcome.No ||
            outcome == IBlindBetMarket.Outcome.Invalid;
    }

    /**
     * @notice Propose an outcome for the market
     * @param marketId Market ID
     * @param outcome Proposed outcome
     * @dev Can be called by resolver after decryption completes
     */
    function _proposeOutcome(
        uint256 marketId,
        IBlindBetMarket.Outcome outcome
    ) internal onlyAuthorizedResolver(marketId) {
        if (!_validateOutcome(outcome)) {
            revert InvalidOutcome();
        }

        emit OutcomeProposed(marketId, outcome, msg.sender);
    }

    /**
     * @notice Get decrypted market totals
     * @param marketId Market ID
     * @return totalYes Decrypted Yes total
     * @return totalNo Decrypted No total
     * @return completed Whether decryption is completed
     */
    function getDecryptedTotals(uint256 marketId)
        external
        view
        returns (
            uint64 totalYes,
            uint64 totalNo,
            bool completed
        )
    {
        return (
            decryptedYesTotal[marketId],
            decryptedNoTotal[marketId],
            decryptionCompleted[marketId]
        );
    }

    /**
     * @notice Check if decryption is completed for a market
     * @param marketId Market ID
     * @return Whether decryption is completed
     */
    function isDecryptionCompleted(uint256 marketId)
        public
        view
        returns (bool)
    {
        return decryptionCompleted[marketId];
    }

    /**
     * @inheritdoc IMarketResolver
     * @dev Must be implemented by derived contracts
     */
    function setResolution(uint256 marketId, IBlindBetMarket.Outcome outcome)
        external
        virtual
        override;

    /**
     * @inheritdoc IMarketResolver
     * @dev Must be implemented by derived contracts
     */
    function isAuthorizedResolver(uint256 marketId, address resolver)
        public
        view
        virtual
        override
        returns (bool);

    /**
     * @inheritdoc IMarketResolver
     * @dev Must be implemented by derived contracts
     */
    function getResolver(uint256 marketId)
        external
        view
        virtual
        override
        returns (address);
}
