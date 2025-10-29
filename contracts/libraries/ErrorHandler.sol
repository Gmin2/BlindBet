// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint8} from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title ErrorHandler
 * @notice Library for FHE-compatible error handling
 * @dev Since FHE operations don't revert on failure, we track errors per user
 *      This allows frontends to query and display appropriate error messages
 */
library ErrorHandler {

    struct LastError {
        euint8 error; // Encrypted error code
        uint256 timestamp; // When error occurred
    }

    struct ErrorCodes {
        euint8 noError;
        euint8 insufficientBalance;
        euint8 insufficientAllowance;
        euint8 invalidAmount;
        euint8 marketNotOpen;
        euint8 deadlinePassed;
        euint8 alreadyClaimed;
        euint8 noPosition;
        euint8 marketNotResolved;
    }

    uint8 public constant NO_ERROR = 0;
    uint8 public constant INSUFFICIENT_BALANCE = 1;
    uint8 public constant INSUFFICIENT_ALLOWANCE = 2;
    uint8 public constant INVALID_AMOUNT = 3;
    uint8 public constant MARKET_NOT_OPEN = 4;
    uint8 public constant DEADLINE_PASSED = 5;
    uint8 public constant ALREADY_CLAIMED = 6;
    uint8 public constant NO_POSITION = 7;
    uint8 public constant MARKET_NOT_RESOLVED = 8;

    event ErrorOccurred(
        address indexed user,
        uint8 errorCode,
        uint256 timestamp
    );

    /**
     * @notice Initialize error codes (call once in constructor)
     * @return noError Encrypted error code for no error
     * @return insufficientBalance Encrypted error code for insufficient balance
     * @return insufficientAllowance Encrypted error code for insufficient allowance
     * @return invalidAmount Encrypted error code for invalid amount
     * @return marketNotOpen Encrypted error code for market not open
     * @return deadlinePassed Encrypted error code for deadline passed
     * @return alreadyClaimed Encrypted error code for already claimed
     * @return noPosition Encrypted error code for no position
     * @return marketNotResolved Encrypted error code for market not resolved
     */
    function initializeErrors()
        internal
        returns (
            euint8 noError,
            euint8 insufficientBalance,
            euint8 insufficientAllowance,
            euint8 invalidAmount,
            euint8 marketNotOpen,
            euint8 deadlinePassed,
            euint8 alreadyClaimed,
            euint8 noPosition,
            euint8 marketNotResolved
        )
    {
        noError = FHE.asEuint8(NO_ERROR);
        insufficientBalance = FHE.asEuint8(INSUFFICIENT_BALANCE);
        insufficientAllowance = FHE.asEuint8(INSUFFICIENT_ALLOWANCE);
        invalidAmount = FHE.asEuint8(INVALID_AMOUNT);
        marketNotOpen = FHE.asEuint8(MARKET_NOT_OPEN);
        deadlinePassed = FHE.asEuint8(DEADLINE_PASSED);
        alreadyClaimed = FHE.asEuint8(ALREADY_CLAIMED);
        noPosition = FHE.asEuint8(NO_POSITION);
        marketNotResolved = FHE.asEuint8(MARKET_NOT_RESOLVED);
    }

    /**
     * @notice Set error for a user
     * @param errors Mapping of user errors
     * @param user User address
     * @param errorCode Encrypted error code
     */
    function setError(
        mapping(address => LastError) storage errors,
        address user,
        euint8 errorCode
    ) internal {
        errors[user] = LastError({
            error: errorCode,
            timestamp: block.timestamp
        });

        // Set ACL permissions so user can decrypt their error
        FHE.allowThis(errorCode);
        FHE.allow(errorCode, user);

        emit ErrorOccurred(user, uint8(0), block.timestamp); // Can't emit encrypted value
    }

    /**
     * @notice Get last error for a user
     * @param errors Mapping of user errors
     * @param user User address
     * @return error Encrypted error code
     * @return timestamp When error occurred
     */
    function getError(
        mapping(address => LastError) storage errors,
        address user
    ) internal view returns (euint8 error, uint256 timestamp) {
        LastError storage lastError = errors[user];
        return (lastError.error, lastError.timestamp);
    }

    /**
     * @notice Clear error for a user (set to NO_ERROR)
     * @param errors Mapping of user errors
     * @param user User address
     * @param noErrorCode Pre-initialized NO_ERROR code
     */
    function clearError(
        mapping(address => LastError) storage errors,
        address user,
        euint8 noErrorCode
    ) internal {
        setError(errors, user, noErrorCode);
    }

    /**
     * @notice Check if user has an error
     * @param errors Mapping of user errors
     * @param user User address
     * @return hasError Whether user has a non-zero error
     */
    function hasError(
        mapping(address => LastError) storage errors,
        address user
    ) internal view returns (bool) {
        return errors[user].timestamp > 0;
    }

    /**
     * @notice Set error conditionally based on encrypted condition
     * @param errors Mapping of user errors
     * @param user User address
     * @param condition When true, set errorCode; when false, set noError
     * @param errorCode Error code to set if condition is true
     * @param noErrorCode No error code to set if condition is false
     */
    function setConditionalError(
        mapping(address => LastError) storage errors,
        address user,
        bool condition,
        euint8 errorCode,
        euint8 noErrorCode
    ) internal {
        if (condition) {
            setError(errors, user, errorCode);
        } else {
            setError(errors, user, noErrorCode);
        }
    }
}
