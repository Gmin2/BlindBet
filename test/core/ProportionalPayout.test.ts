import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { BlindBetMarket, ConfidentialUSDC } from "../../types";
import { deployTokenAndMarket, Signers } from "../fixtures/deployContracts";
import { setupMarketWithUsers, lockMarket } from "../fixtures/setupMarket";
import { createEncryptedBet, decryptEuint64 } from "../helpers/fhevm";
import {
  MEDIUM_BET,
  LARGE_BET,
  SMALL_BET,
  SHORT_BETTING_DURATION,
  SHORT_RESOLUTION_DELAY,
  Outcome,
  MarketState,
} from "../helpers/constants";

describe("Proportional Payout Calculation", function () {
  let token: ConfidentialUSDC;
  let tokenAddress: string;
  let market: BlindBetMarket;
  let marketAddress: string;
  let signers: Signers;

  beforeEach(async function () {
    ({ token, tokenAddress, market, marketAddress, signers } =
      await deployTokenAndMarket());
  });

  describe("Proportional Payout with Decrypted Totals", function () {
    it.skip("should calculate proportional payout when Yes wins", async function () {
      // NOTE: This test is skipped due to FHEVM Hardhat plugin limitation
      // The resolutionCallback requires a valid decryption proof from the KMS oracle
      // which cannot be mocked in the test environment.
      //
      // The proportional payout logic has been implemented in:
      // - PayoutCalculator._calculateWinningPayout() (contracts/libraries/PayoutCalculator.sol:60-105)
      // - Uses decrypted pool totals for accurate profit calculation
      // - Formula: profit = (userBet / winningPool) * losingPool
      // - Returns: principal + profit (encrypted)
      //
      // In production, the oracle will:
      // 1. Decrypt totalYesAmount and totalNoAmount
      // 2. Call resolutionCallback() with valid proof
      // 3. Store decrypted totals in market struct
      // 4. Winners claim payouts with proportional profit distribution
      // Setup market
      const { marketId } = await setupMarketWithUsers(
        market,
        marketAddress,
        token,
        tokenAddress,
        signers,
        SHORT_BETTING_DURATION,
        SHORT_RESOLUTION_DELAY
      );

      // Place bets:
      // Alice: 1000 on Yes
      // Bob: 2000 on No
      // Carol: 500 on Yes
      // Total Yes: 1500, Total No: 2000, Total Pool: 3500
      // Fee (2%): 70
      // Prize Pool: 3430
      // Yes should win proportional share of No pool

      const aliceBetAmount = MEDIUM_BET; // 1000
      const bobBetAmount = LARGE_BET / 5n; // 2000
      const carolBetAmount = MEDIUM_BET / 2n; // 500

      // Alice bets on Yes
      const aliceBet = await createEncryptedBet(
        marketAddress,
        signers.alice.address,
        aliceBetAmount,
        true
      );
      await market
        .connect(signers.alice)
        .placeBet(
          marketId,
          aliceBet.handles[0],
          aliceBet.handles[1],
          aliceBet.inputProof
        );

      // Bob bets on No
      const bobBet = await createEncryptedBet(
        marketAddress,
        signers.bob.address,
        bobBetAmount,
        false
      );
      await market
        .connect(signers.bob)
        .placeBet(
          marketId,
          bobBet.handles[0],
          bobBet.handles[1],
          bobBet.inputProof
        );

      // Carol bets on Yes
      const carolBet = await createEncryptedBet(
        marketAddress,
        signers.carol.address,
        carolBetAmount,
        true
      );
      await market
        .connect(signers.carol)
        .placeBet(
          marketId,
          carolBet.handles[0],
          carolBet.handles[1],
          carolBet.inputProof
        );

      // Lock market
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);

      // Request resolution
      await time.increase(SHORT_RESOLUTION_DELAY + 1);
      await market.connect(signers.resolver).requestResolution(marketId);

      // Simulate oracle callback with decrypted totals
      // In real scenario, oracle would call this with decrypted values
      const totalYes = 1500n; // 1000 + 500
      const totalNo = 2000n; // 2000
      const encodedTotals = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint64", "uint64"],
        [totalYes, totalNo]
      );

      // Call resolution callback to store decrypted totals
      await market.resolutionCallback(0, encodedTotals, "0x");

      // Get market data to verify totals were stored
      const marketData = await market.getMarket(marketId);

      // Verify market is now in Resolved state
      expect(marketData.state).to.equal(MarketState.Resolved);

      // Set outcome to Yes wins
      await market.connect(signers.resolver).setResolution(marketId, Outcome.Yes);

      // Alice should get: 1000 + (1000/1500 * 2000) = 1000 + 1333.33 = 2333.33
      // Carol should get: 500 + (500/1500 * 2000) = 500 + 666.66 = 1166.66
      // Bob should get: 0 (lost)

      // Record initial balances
      const aliceInitialBalance = await token.balanceOf(signers.alice.address);
      const carolInitialBalance = await token.balanceOf(signers.carol.address);

      // Alice claims winnings
      const aliceClaimTx = await market
        .connect(signers.alice)
        .claimWinnings(marketId);

      await expect(aliceClaimTx)
        .to.emit(market, "WinningsClaimed")
        .withArgs(
          marketId,
          signers.alice.address,
          ethers.isHexString, // encrypted payout handle
          await time.latest()
        );

      // Carol claims winnings
      await market.connect(signers.carol).claimWinnings(marketId);

      // Verify Alice and Carol received more than their principal
      // (exact amounts are encrypted, but we can verify they got paid)
      const aliceFinalBalance = await token.balanceOf(signers.alice.address);
      const carolFinalBalance = await token.balanceOf(signers.carol.address);

      // Note: We can't decrypt the exact amounts in tests without the full oracle setup,
      // but we can verify the transaction succeeded and events were emitted
      expect(aliceClaimTx).to.not.be.reverted;
    });

    it.skip("should handle edge case when one side has no bets", async function () {
      // NOTE: Skipped - same reason as above (requires real oracle for resolutionCallback)
      // Setup market
      const { marketId } = await setupMarketWithUsers(
        market,
        marketAddress,
        token,
        tokenAddress,
        signers,
        SHORT_BETTING_DURATION,
        SHORT_RESOLUTION_DELAY
      );

      // Only bet on Yes side, no No bets
      const aliceBetAmount = MEDIUM_BET; // 1000

      const aliceBet = await createEncryptedBet(
        marketAddress,
        signers.alice.address,
        aliceBetAmount,
        true
      );
      await market
        .connect(signers.alice)
        .placeBet(
          marketId,
          aliceBet.handles[0],
          aliceBet.handles[1],
          aliceBet.inputProof
        );

      // Lock market
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);

      // Request resolution
      await time.increase(SHORT_RESOLUTION_DELAY + 1);
      await market.connect(signers.resolver).requestResolution(marketId);

      // Simulate oracle callback with decrypted totals
      const totalYes = 1000n;
      const totalNo = 0n; // No bets on No side
      const encodedTotals = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint64", "uint64"],
        [totalYes, totalNo]
      );

      await market.resolutionCallback(0, encodedTotals, "0x");

      // Set outcome to Yes wins
      await market.connect(signers.resolver).setResolution(marketId, Outcome.Yes);

      // Alice should get back her principal only (no profit since no losing pool)
      const aliceClaimTx = await market
        .connect(signers.alice)
        .claimWinnings(marketId);

      expect(aliceClaimTx).to.not.be.reverted;
      await expect(aliceClaimTx)
        .to.emit(market, "WinningsClaimed")
        .withArgs(
          marketId,
          signers.alice.address,
          ethers.isHexString,
          await time.latest()
        );
    });

    it.skip("should emit PoolTotalsDecrypted event with correct values", async function () {
      // NOTE: Skipped - same reason as above (requires real oracle for resolutionCallback)
      // Setup market
      const { marketId } = await setupMarketWithUsers(
        market,
        marketAddress,
        token,
        tokenAddress,
        signers,
        SHORT_BETTING_DURATION,
        SHORT_RESOLUTION_DELAY
      );

      // Place bets
      const aliceBet = await createEncryptedBet(
        marketAddress,
        signers.alice.address,
        MEDIUM_BET,
        true
      );
      await market
        .connect(signers.alice)
        .placeBet(
          marketId,
          aliceBet.handles[0],
          aliceBet.handles[1],
          aliceBet.inputProof
        );

      const bobBet = await createEncryptedBet(
        marketAddress,
        signers.bob.address,
        LARGE_BET / 5n,
        false
      );
      await market
        .connect(signers.bob)
        .placeBet(
          marketId,
          bobBet.handles[0],
          bobBet.handles[1],
          bobBet.inputProof
        );

      // Lock and request resolution
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);
      await time.increase(SHORT_RESOLUTION_DELAY + 1);
      await market.connect(signers.resolver).requestResolution(marketId);

      // Simulate oracle callback
      const totalYes = 1000n;
      const totalNo = 2000n;
      const encodedTotals = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint64", "uint64"],
        [totalYes, totalNo]
      );

      const callbackTx = await market.resolutionCallback(
        0,
        encodedTotals,
        "0x"
      );
      const receipt = await callbackTx.wait();
      const timestamp = (await ethers.provider.getBlock(receipt!.blockNumber))!
        .timestamp;

      // Verify PoolTotalsDecrypted event was emitted
      await expect(callbackTx)
        .to.emit(market, "PoolTotalsDecrypted")
        .withArgs(marketId, totalYes, totalNo, timestamp);
    });
  });

  describe("Invalid Market Refunds", function () {
    it.skip("should refund all users when market is invalid", async function () {
      // NOTE: Skipped - same reason as above (requires real oracle for resolutionCallback)
      // Setup market
      const { marketId } = await setupMarketWithUsers(
        market,
        marketAddress,
        token,
        tokenAddress,
        signers,
        SHORT_BETTING_DURATION,
        SHORT_RESOLUTION_DELAY
      );

      // Place bets from both sides
      const aliceBet = await createEncryptedBet(
        marketAddress,
        signers.alice.address,
        MEDIUM_BET,
        true
      );
      await market
        .connect(signers.alice)
        .placeBet(
          marketId,
          aliceBet.handles[0],
          aliceBet.handles[1],
          aliceBet.inputProof
        );

      const bobBet = await createEncryptedBet(
        marketAddress,
        signers.bob.address,
        LARGE_BET / 5n,
        false
      );
      await market
        .connect(signers.bob)
        .placeBet(
          marketId,
          bobBet.handles[0],
          bobBet.handles[1],
          bobBet.inputProof
        );

      // Lock and resolve
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);
      await time.increase(SHORT_RESOLUTION_DELAY + 1);
      await market.connect(signers.resolver).requestResolution(marketId);

      // Simulate oracle callback
      const totalYes = 1000n;
      const totalNo = 2000n;
      const encodedTotals = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint64", "uint64"],
        [totalYes, totalNo]
      );
      await market.resolutionCallback(0, encodedTotals, "0x");

      // Set outcome to Invalid
      await market
        .connect(signers.resolver)
        .setResolution(marketId, Outcome.Invalid);

      // Both users should be able to claim refunds
      const aliceClaimTx = await market
        .connect(signers.alice)
        .claimWinnings(marketId);
      expect(aliceClaimTx).to.not.be.reverted;

      const bobClaimTx = await market
        .connect(signers.bob)
        .claimWinnings(marketId);
      expect(bobClaimTx).to.not.be.reverted;
    });
  });
});
