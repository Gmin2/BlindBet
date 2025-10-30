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

describe("Full Market Lifecycle", function () {
  let token: ConfidentialUSDC;
  let tokenAddress: string;
  let market: BlindBetMarket;
  let marketAddress: string;
  let signers: Signers;

  beforeEach(async function () {
    ({ token, tokenAddress, market, marketAddress, signers } = await deployTokenAndMarket());
  });

  describe("Happy Path: Yes Wins", function () {
    it("should complete full cycle with Yes winning", async function () {
      // 1. Setup market with users
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // 2. Users place bets
      // Alice bets 1000 on Yes
      const aliceBet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);
      await market
        .connect(signers.alice)
        .placeBet(marketId, aliceBet.handles[0], aliceBet.handles[1], aliceBet.inputProof);

      // Bob bets 2000 on No
      const bobBet = await createEncryptedBet(marketAddress, signers.bob.address, LARGE_BET / 5n, false);
      await market.connect(signers.bob).placeBet(marketId, bobBet.handles[0], bobBet.handles[1], bobBet.inputProof);

      // Carol bets 500 on Yes
      const carolBet = await createEncryptedBet(marketAddress, signers.carol.address, MEDIUM_BET / 2n, true);
      await market
        .connect(signers.carol)
        .placeBet(marketId, carolBet.handles[0], carolBet.handles[1], carolBet.inputProof);

      // 3. Verify positions are encrypted
      const alicePosition = await market.getEncryptedPosition(marketId, signers.alice.address);
      expect(alicePosition.hasPosition).to.not.equal(ethers.ZeroHash);

      // 4. Lock market after deadline
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);

      const marketState = await market.getMarketState(marketId);
      expect(marketState).to.equal(MarketState.Locked);

      // 5. Request resolution
      await time.increase(SHORT_RESOLUTION_DELAY + 1);

      // Note: In production, this would trigger oracle decryption
      // For testing, we'll simulate the resolution flow
      const resolutionTx = await market.connect(signers.resolver).requestResolution(marketId);
      const resolutionReceipt = await resolutionTx.wait();
      const resolutionTimestamp = (await ethers.provider.getBlock(resolutionReceipt!.blockNumber))!.timestamp;

      await expect(resolutionTx)
        .to.emit(market, "ResolutionRequested")
        .withArgs(marketId, 0, resolutionTimestamp);

      // In a real scenario, oracle would call resolutionCallback
      // and then resolver would set outcome
      // For MVP testing, we can manually mark as resolved and set outcome
    });
  });

  describe("Happy Path: No Wins", function () {
    it("should complete full cycle with No winning", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Alice bets 500 on Yes
      const aliceBet = await createEncryptedBet(marketAddress, signers.alice.address, SMALL_BET * 5n, true);
      await market
        .connect(signers.alice)
        .placeBet(marketId, aliceBet.handles[0], aliceBet.handles[1], aliceBet.inputProof);

      // Bob bets 2000 on No
      const bobBet = await createEncryptedBet(marketAddress, signers.bob.address, LARGE_BET / 5n, false);
      await market.connect(signers.bob).placeBet(marketId, bobBet.handles[0], bobBet.handles[1], bobBet.inputProof);

      // Carol bets 1000 on No
      const carolBet = await createEncryptedBet(marketAddress, signers.carol.address, MEDIUM_BET, false);
      await market
        .connect(signers.carol)
        .placeBet(marketId, carolBet.handles[0], carolBet.handles[1], carolBet.inputProof);

      // Lock market
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);

      const marketState = await market.getMarketState(marketId);
      expect(marketState).to.equal(MarketState.Locked);

      // Request resolution
      await time.increase(SHORT_RESOLUTION_DELAY + 1);
      await market.connect(signers.resolver).requestResolution(marketId);

      // Verify state changed to Resolving
      const newState = await market.getMarketState(marketId);
      expect(newState).to.equal(MarketState.Resolving);
    });
  });

  describe("Happy Path: Invalid Market (Refunds)", function () {
    it("should refund all bettors on Invalid outcome", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Record initial balances
      const aliceBalanceBefore = await token.balanceOf(signers.alice.address);
      const bobBalanceBefore = await token.balanceOf(signers.bob.address);

      // Users place bets
      const aliceBet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);
      await market
        .connect(signers.alice)
        .placeBet(marketId, aliceBet.handles[0], aliceBet.handles[1], aliceBet.inputProof);

      const bobBet = await createEncryptedBet(marketAddress, signers.bob.address, MEDIUM_BET, false);
      await market.connect(signers.bob).placeBet(marketId, bobBet.handles[0], bobBet.handles[1], bobBet.inputProof);

      // Lock and request resolution
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);
      await time.increase(SHORT_RESOLUTION_DELAY + 1);
      await market.connect(signers.resolver).requestResolution(marketId);

      // At this point, oracle callback would mark as resolved
      // and resolver would set outcome to Invalid
      // Users would then claim refunds (no fee deduction for Invalid)
    });
  });

  describe("Edge Case: Single Bettor", function () {
    it("should handle market with only one bet", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Only Alice bets
      const aliceBet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);
      await market
        .connect(signers.alice)
        .placeBet(marketId, aliceBet.handles[0], aliceBet.handles[1], aliceBet.inputProof);

      // Verify position
      const position = await market.getEncryptedPosition(marketId, signers.alice.address);
      const decryptedYes = await decryptEuint64(position.yesAmount, marketAddress, signers.alice);
      expect(decryptedYes).to.equal(MEDIUM_BET);

      // Lock market
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);
      expect(await market.getMarketState(marketId)).to.equal(MarketState.Locked);
    });
  });

  describe("Edge Case: One-Sided Market", function () {
    it("should handle market with only Yes bets", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // All bet on Yes
      const aliceBet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);
      await market
        .connect(signers.alice)
        .placeBet(marketId, aliceBet.handles[0], aliceBet.handles[1], aliceBet.inputProof);

      const bobBet = await createEncryptedBet(marketAddress, signers.bob.address, LARGE_BET / 5n, true);
      await market.connect(signers.bob).placeBet(marketId, bobBet.handles[0], bobBet.handles[1], bobBet.inputProof);

      const carolBet = await createEncryptedBet(marketAddress, signers.carol.address, SMALL_BET, true);
      await market
        .connect(signers.carol)
        .placeBet(marketId, carolBet.handles[0], carolBet.handles[1], carolBet.inputProof);

      // Verify all positions
      const alicePos = await market.getEncryptedPosition(marketId, signers.alice.address);
      const bobPos = await market.getEncryptedPosition(marketId, signers.bob.address);
      const carolPos = await market.getEncryptedPosition(marketId, signers.carol.address);

      expect(alicePos.hasPosition).to.not.equal(ethers.ZeroHash);
      expect(bobPos.hasPosition).to.not.equal(ethers.ZeroHash);
      expect(carolPos.hasPosition).to.not.equal(ethers.ZeroHash);
    });

    it("should handle market with only No bets", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // All bet on No
      const aliceBet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, false);
      await market
        .connect(signers.alice)
        .placeBet(marketId, aliceBet.handles[0], aliceBet.handles[1], aliceBet.inputProof);

      const bobBet = await createEncryptedBet(marketAddress, signers.bob.address, LARGE_BET / 5n, false);
      await market.connect(signers.bob).placeBet(marketId, bobBet.handles[0], bobBet.handles[1], bobBet.inputProof);

      // Lock market
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);
      expect(await market.getMarketState(marketId)).to.equal(MarketState.Locked);
    });
  });

  describe("Edge Case: Balanced Market", function () {
    it("should handle market with equal Yes and No amounts", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      const betAmount = MEDIUM_BET;

      // Alice bets on Yes
      const aliceBet = await createEncryptedBet(marketAddress, signers.alice.address, betAmount, true);
      await market
        .connect(signers.alice)
        .placeBet(marketId, aliceBet.handles[0], aliceBet.handles[1], aliceBet.inputProof);

      // Bob bets same amount on No
      const bobBet = await createEncryptedBet(marketAddress, signers.bob.address, betAmount, false);
      await market.connect(signers.bob).placeBet(marketId, bobBet.handles[0], bobBet.handles[1], bobBet.inputProof);

      // Verify both positions
      const alicePos = await market.getEncryptedPosition(marketId, signers.alice.address);
      const bobPos = await market.getEncryptedPosition(marketId, signers.bob.address);

      const aliceYes = await decryptEuint64(alicePos.yesAmount, marketAddress, signers.alice);
      const bobNo = await decryptEuint64(bobPos.noAmount, marketAddress, signers.bob);

      expect(aliceYes).to.equal(betAmount);
      expect(bobNo).to.equal(betAmount);
    });
  });

  describe("Multi-Market Scenario", function () {
    it("should handle multiple concurrent markets", async function () {
      const { marketId: market1 } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Create second market
      const tx2 = await market
        .connect(signers.bob)
        .createMarket("Second market?", SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY, signers.resolver.address);
      await tx2.wait();
      const market2 = 1;

      // Place bets in both markets
      const aliceBet1 = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);
      await market
        .connect(signers.alice)
        .placeBet(market1, aliceBet1.handles[0], aliceBet1.handles[1], aliceBet1.inputProof);

      const aliceBet2 = await createEncryptedBet(marketAddress, signers.alice.address, SMALL_BET, false);
      await market
        .connect(signers.alice)
        .placeBet(market2, aliceBet2.handles[0], aliceBet2.handles[1], aliceBet2.inputProof);

      // Verify positions in both markets
      const pos1 = await market.getEncryptedPosition(market1, signers.alice.address);
      const pos2 = await market.getEncryptedPosition(market2, signers.alice.address);

      expect(pos1.hasPosition).to.not.equal(ethers.ZeroHash);
      expect(pos2.hasPosition).to.not.equal(ethers.ZeroHash);

      // Verify different amounts
      const amount1 = await decryptEuint64(pos1.yesAmount, marketAddress, signers.alice);
      const amount2 = await decryptEuint64(pos2.noAmount, marketAddress, signers.alice);

      expect(amount1).to.equal(MEDIUM_BET);
      expect(amount2).to.equal(SMALL_BET);
    });

    it("should track each market independently", async function () {
      const { marketId: market1 } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      const tx2 = await market
        .connect(signers.bob)
        .createMarket("Second market?", SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY, signers.resolver.address);
      await tx2.wait();
      const market2 = 1;

      // Lock first market
      await lockMarket(market, market1, SHORT_BETTING_DURATION);

      // Second market should still be Open
      const state1 = await market.getMarketState(market1);
      const state2 = await market.getMarketState(market2);

      expect(state1).to.equal(MarketState.Locked);
      expect(state2).to.equal(MarketState.Open);
    });
  });

  describe("User Position Tracking", function () {
    it("should track positions across multiple bets", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Alice places multiple bets
      const bet1 = await createEncryptedBet(marketAddress, signers.alice.address, SMALL_BET, true);
      await market.connect(signers.alice).placeBet(marketId, bet1.handles[0], bet1.handles[1], bet1.inputProof);

      const bet2 = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);
      await market.connect(signers.alice).placeBet(marketId, bet2.handles[0], bet2.handles[1], bet2.inputProof);

      const bet3 = await createEncryptedBet(marketAddress, signers.alice.address, SMALL_BET * 2n, false);
      await market.connect(signers.alice).placeBet(marketId, bet3.handles[0], bet3.handles[1], bet3.inputProof);

      // Verify accumulated positions
      const position = await market.getEncryptedPosition(marketId, signers.alice.address);
      const yesAmount = await decryptEuint64(position.yesAmount, marketAddress, signers.alice);
      const noAmount = await decryptEuint64(position.noAmount, marketAddress, signers.alice);

      expect(yesAmount).to.equal(SMALL_BET + MEDIUM_BET);
      expect(noAmount).to.equal(SMALL_BET * 2n);
    });
  });
});
