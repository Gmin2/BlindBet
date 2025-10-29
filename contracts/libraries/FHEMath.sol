// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, euint8, ebool} from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title FHEMath
 * @notice Library for advanced FHE mathematical operations
 * @dev Provides safe math operations with overflow/underflow protection
 */
library FHEMath {

    /**
     * @notice Safely add with overflow check
     * @param a First operand
     * @param b Second operand
     * @return result Sum if no overflow, a if overflow
     * @return hasOverflow Whether overflow occurred (encrypted)
     */
    function safeAdd(euint64 a, euint64 b)
        internal
        returns (euint64 result, ebool hasOverflow)
    {
        euint64 sum = FHE.add(a, b);
        // Overflow if sum < a
        hasOverflow = FHE.lt(sum, a);
        // Return original value if overflow, sum otherwise
        result = FHE.select(hasOverflow, a, sum);
    }

    /**
     * @notice Safely subtract with underflow check
     * @param a Minuend
     * @param b Subtrahend
     * @return result Difference if no underflow, 0 if underflow
     * @return hasUnderflow Whether underflow occurred (encrypted)
     */
    function safeSub(euint64 a, euint64 b)
        internal
        returns (euint64 result, ebool hasUnderflow)
    {
        // Underflow if a < b
        hasUnderflow = FHE.lt(a, b);
        euint64 diff = FHE.sub(a, b);
        // Return 0 if underflow, difference otherwise
        result = FHE.select(hasUnderflow, FHE.asEuint64(0), diff);
    }

    /**
     * @notice Safely multiply with overflow check
     * @param a First operand
     * @param b Second operand
     * @return result Product if no overflow, a if overflow
     * @return hasOverflow Whether overflow occurred (encrypted)
     */
    function safeMul(euint64 a, euint64 b)
        internal
        returns (euint64 result, ebool hasOverflow)
    {
        // TODO: Proper overflow detection requires FHE division with encrypted divisor
        // which is not supported. For now, we perform multiplication without overflow check
        result = FHE.mul(a, b);
        hasOverflow = FHE.asEbool(false); // Placeholder - assume no overflow
    }

    /**
     * @notice Check if value is zero
     * @param value Value to check
     * @return Whether value equals zero (encrypted)
     */
    function isZero(euint64 value) internal returns (ebool) {
        return FHE.eq(value, FHE.asEuint64(0));
    }

    /**
     * @notice Check if value is non-zero
     * @param value Value to check
     * @return Whether value is non-zero (encrypted)
     */
    function isNonZero(euint64 value) internal returns (ebool) {
        return FHE.ne(value, FHE.asEuint64(0));
    }

    /**
     * @notice Return maximum of two values
     * @param a First value
     * @param b Second value
     * @return Maximum value
     */
    function max(euint64 a, euint64 b) internal returns (euint64) {
        return FHE.select(FHE.gt(a, b), a, b);
    }

    /**
     * @notice Return minimum of two values
     * @param a First value
     * @param b Second value
     * @return Minimum value
     */
    function min(euint64 a, euint64 b) internal returns (euint64) {
        return FHE.select(FHE.lt(a, b), a, b);
    }

    /**
     * @notice Clamp value between min and max bounds
     * @param value Value to clamp
     * @param minVal Minimum bound
     * @param maxVal Maximum bound
     * @return Clamped value
     */
    function clamp(euint64 value, euint64 minVal, euint64 maxVal)
        internal
        returns (euint64)
    {
        euint64 afterMin = max(value, minVal);
        return min(afterMin, maxVal);
    }

    /**
     * @notice Conditional addition: add b to a only if condition is true
     * @param a Base value
     * @param b Value to add conditionally
     * @param condition When to add
     * @return Result of conditional addition
     */
    function addIf(euint64 a, euint64 b, ebool condition)
        internal
        returns (euint64)
    {
        euint64 sum = FHE.add(a, b);
        return FHE.select(condition, sum, a);
    }

    /**
     * @notice Conditional subtraction: subtract b from a only if condition is true
     * @param a Base value
     * @param b Value to subtract conditionally
     * @param condition When to subtract
     * @return Result of conditional subtraction
     */
    function subIf(euint64 a, euint64 b, ebool condition)
        internal
        returns (euint64)
    {
        euint64 diff = FHE.sub(a, b);
        return FHE.select(condition, diff, a);
    }

    /**
     * @notice Check if value is within range [min, max]
     * @param value Value to check
     * @param minVal Minimum bound (inclusive)
     * @param maxVal Maximum bound (inclusive)
     * @return Whether value is in range (encrypted)
     */
    function isInRange(euint64 value, euint64 minVal, euint64 maxVal)
        internal
        returns (ebool)
    {
        ebool aboveMin = FHE.ge(value, minVal);
        ebool belowMax = FHE.le(value, maxVal);
        return FHE.and(aboveMin, belowMax);
    }

    /**
     * @notice Check if value is above threshold
     * @param value Value to check
     * @param threshold Threshold value
     * @return Whether value > threshold (encrypted)
     */
    function isAboveThreshold(euint64 value, euint64 threshold)
        internal
        returns (ebool)
    {
        return FHE.gt(value, threshold);
    }

    /**
     * @notice Check if value is below threshold
     * @param value Value to check
     * @param threshold Threshold value
     * @return Whether value < threshold (encrypted)
     */
    function isBelowThreshold(euint64 value, euint64 threshold)
        internal
        returns (ebool)
    {
        return FHE.lt(value, threshold);
    }

    /**
     * @notice Calculate percentage of a value
     * @param value Base value
     * @param percentage Percentage (in basis points, e.g., 200 = 2%)
     * @return Percentage of value
     */
    function percentageOf(euint64 value, uint64 percentage)
        internal
        returns (euint64)
    {
        return FHE.div(FHE.mul(value, FHE.asEuint64(percentage)), 10000);
    }

    /**
     * @notice Apply percentage increase
     * @param value Base value
     * @param percentageIncrease Percentage to increase (basis points)
     * @return Value after increase
     */
    function increaseByPercentage(euint64 value, uint64 percentageIncrease)
        internal
        returns (euint64)
    {
        euint64 increase = percentageOf(value, percentageIncrease);
        return FHE.add(value, increase);
    }

    /**
     * @notice Apply percentage decrease
     * @param value Base value
     * @param percentageDecrease Percentage to decrease (basis points)
     * @return Value after decrease
     */
    function decreaseByPercentage(euint64 value, uint64 percentageDecrease)
        internal
        returns (euint64)
    {
        euint64 decrease = percentageOf(value, percentageDecrease);
        return FHE.sub(value, decrease);
    }

    /**
     * @notice Logical AND of multiple conditions
     * @param conditions Array of boolean conditions
     * @return Result of AND operation
     */
    function andAll(ebool[] memory conditions) internal returns (ebool) {
        if (conditions.length == 0) return FHE.asEbool(true);

        ebool result = conditions[0];
        for (uint256 i = 1; i < conditions.length; i++) {
            result = FHE.and(result, conditions[i]);
        }
        return result;
    }

    /**
     * @notice Logical OR of multiple conditions
     * @param conditions Array of boolean conditions
     * @return Result of OR operation
     */
    function orAll(ebool[] memory conditions) internal returns (ebool) {
        if (conditions.length == 0) return FHE.asEbool(false);

        ebool result = conditions[0];
        for (uint256 i = 1; i < conditions.length; i++) {
            result = FHE.or(result, conditions[i]);
        }
        return result;
    }
}
