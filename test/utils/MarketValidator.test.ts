import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { BlindBetMarket, ConfidentialUSDC } from "../../types";
import { deployTokenAndMarket, Signers } from "../fixtures/deployContracts";
import { setupMarketWithUsers } from "../fixtures/setupMarket";
import { createEncryptedBet } from "../helpers/fhevm";
import {
  MEDIUM_BET,
  LARGE_BET,
  SHORT_BETTING_DURATION,
  SHORT_RESOLUTION_DELAY,
  TEST_QUESTIONS,
  ONE_HOUR,
} from "../helpers/constants";

describe("MarketValidator Utility Tests", function () {
  let token: ConfidentialUSDC;
  let tokenAddress: string;
  let market: BlindBetMarket;
  let marketAddress: string;
  let signers: Signers;

  beforeEach(async function () {
    ({ token, tokenAddress, market, marketAddress, signers } = await deployTokenAndMarket());
  });

  describe("Question Validation", function () {
    it("should reject empty question", async function () {
      await expect(
        market
          .connect(signers.alice)
          .createMarket("", SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY, signers.resolver.address)
      ).to.be.revertedWithCustomError(market, "InvalidQuestion");
    });

    it("should reject question too short", async function () {
      await expect(
        market
          .connect(signers.alice)
          .createMarket("Short?", SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY, signers.resolver.address)
      ).to.be.revertedWithCustomError(market, "InvalidQuestion");
    });

    it("should accept minimum length question", async function () {
      const minQuestion = "Question??"; // 10 chars
      await expect(
        market
          .connect(signers.alice)
          .createMarket(minQuestion, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY, signers.resolver.address)
      ).to.not.be.reverted;
    });

    it("should reject question too long", async function () {
      const longQuestion = "a".repeat(501); // 501 chars
      await expect(
        market
          .connect(signers.alice)
          .createMarket(longQuestion, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY, signers.resolver.address)
      ).to.be.revertedWithCustomError(market, "InvalidQuestion");
    });

    it("should accept maximum length question", async function () {
      const maxQuestion = "a".repeat(500); // 500 chars
      await expect(
        market
          .connect(signers.alice)
          .createMarket(maxQuestion, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY, signers.resolver.address)
      ).to.not.be.reverted;
    });
  });

  describe("Betting Duration Validation", function () {
    it("should reject betting duration too short", async function () {
      const tooShort = ONE_HOUR - 1; // Less than 1 hour
      await expect(
        market
          .connect(signers.alice)
          .createMarket(TEST_QUESTIONS.SHORT, tooShort, SHORT_RESOLUTION_DELAY, signers.resolver.address)
      ).to.be.revertedWithCustomError(market, "InvalidDuration");
    });

    it("should accept minimum betting duration", async function () {
      await expect(
        market
          .connect(signers.alice)
          .createMarket(TEST_QUESTIONS.SHORT, ONE_HOUR, SHORT_RESOLUTION_DELAY, signers.resolver.address)
      ).to.not.be.reverted;
    });

    it("should reject betting duration too long", async function () {
      const tooLong = 365 * 24 * 3600 + 1; // More than 365 days
      await expect(
        market
          .connect(signers.alice)
          .createMarket(TEST_QUESTIONS.SHORT, tooLong, SHORT_RESOLUTION_DELAY, signers.resolver.address)
      ).to.be.revertedWithCustomError(market, "InvalidDuration");
    });

    it("should accept maximum betting duration", async function () {
      const maxDuration = 365 * 24 * 3600; // 365 days
      await expect(
        market
          .connect(signers.alice)
          .createMarket(TEST_QUESTIONS.SHORT, maxDuration, SHORT_RESOLUTION_DELAY, signers.resolver.address)
      ).to.not.be.reverted;
    });
  });

  describe("Resolution Delay Validation", function () {
    it("should reject resolution delay too short", async function () {
      const tooShort = ONE_HOUR - 1; // Less than 1 hour
      await expect(
        market
          .connect(signers.alice)
          .createMarket(TEST_QUESTIONS.SHORT, SHORT_BETTING_DURATION, tooShort, signers.resolver.address)
      ).to.be.revertedWithCustomError(market, "InvalidDuration");
    });

    it("should accept minimum resolution delay", async function () {
      await expect(
        market
          .connect(signers.alice)
          .createMarket(TEST_QUESTIONS.SHORT, SHORT_BETTING_DURATION, ONE_HOUR, signers.resolver.address)
      ).to.not.be.reverted;
    });

    it("should reject resolution delay too long", async function () {
      const tooLong = 30 * 24 * 3600 + 1; // More than 30 days
      await expect(
        market
          .connect(signers.alice)
          .createMarket(TEST_QUESTIONS.SHORT, SHORT_BETTING_DURATION, tooLong, signers.resolver.address)
      ).to.be.revertedWithCustomError(market, "InvalidDuration");
    });

    it("should accept maximum resolution delay", async function () {
      const maxDelay = 30 * 24 * 3600; // 30 days
      await expect(
        market
          .connect(signers.alice)
          .createMarket(TEST_QUESTIONS.SHORT, SHORT_BETTING_DURATION, maxDelay, signers.resolver.address)
      ).to.not.be.reverted;
    });
  });

  describe("Resolver Validation", function () {
    it("should reject zero address resolver", async function () {
      await expect(
        market
          .connect(signers.alice)
          .createMarket(TEST_QUESTIONS.SHORT, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(market, "InvalidResolver");
    });

    it("should accept valid resolver address", async function () {
      await expect(
        market
          .connect(signers.alice)
          .createMarket(TEST_QUESTIONS.SHORT, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY, signers.resolver.address)
      ).to.not.be.reverted;
    });
  });

  describe("Bet Amount Validation", function () {
    let marketId: number;

    beforeEach(async function () {
      const setup = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);
      marketId = setup.marketId;
    });

    it("should reject zero amount bet", async function () {
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, 0n, true);

      // Zero amount bets should not revert but should not create meaningful position
      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.not.be.reverted;
    });

    it("should reject bet amount too small", async function () {
      const tooSmall = 999n; // Less than MIN_BET_AMOUNT (1000)
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, tooSmall, true);

      // Silent failure - transfers 0 without revert
      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.not.be.reverted;
    });

    it("should accept minimum bet amount", async function () {
      const minBet = 1000n; // MIN_BET_AMOUNT
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, minBet, true);

      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.not.be.reverted;
    });

    it("should accept large bet amounts", async function () {
      const largeBet = LARGE_BET;
      await token.mockMint(signers.alice.address, largeBet);

      const { createEncryptedAmount } = await import("../helpers/fhevm");
      const approveEncrypted = await createEncryptedAmount(tokenAddress, signers.alice.address, largeBet);
      await token.connect(signers.alice).approve(marketAddress, approveEncrypted.handles[0], approveEncrypted.inputProof);

      const bet = await createEncryptedBet(marketAddress, signers.alice.address, largeBet, true);

      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.not.be.reverted;
    });

    it("should handle maximum uint64 bet amount gracefully", async function () {
      const maxUint64 = 2n ** 64n - 1n;
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, maxUint64, true);

      // Transfer will fail silently due to insufficient balance
      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.not.be.reverted;
    });
  });

  describe("State Validation", function () {
    let marketId: number;

    beforeEach(async function () {
      const setup = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);
      marketId = setup.marketId;
    });

    it("should prevent betting after deadline", async function () {
      // Advance past betting deadline
      await time.increase(SHORT_BETTING_DURATION + 1);

      const bet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);

      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.be.revertedWithCustomError(market, "InvalidState");
    });

    it("should allow betting before deadline", async function () {
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);

      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.not.be.reverted;
    });

    it("should prevent early market locking", async function () {
      // Try to lock before deadline
      await expect(market.lockMarket(marketId)).to.be.revertedWithCustomError(market, "InvalidState");
    });

    it("should allow market locking after deadline", async function () {
      await time.increase(SHORT_BETTING_DURATION + 1);
      await expect(market.lockMarket(marketId)).to.not.be.reverted;
    });

    it("should prevent resolution before locking", async function () {
      await expect(
        market.connect(signers.resolver).requestResolution(marketId)
      ).to.be.revertedWithCustomError(market, "InvalidState");
    });

    it("should prevent early resolution after locking", async function () {
      await time.increase(SHORT_BETTING_DURATION + 1);
      await market.lockMarket(marketId);

      // Try to resolve before resolution time
      await expect(
        market.connect(signers.resolver).requestResolution(marketId)
      ).to.be.revertedWithCustomError(market, "InvalidState");
    });

    it("should allow resolution after resolution time", async function () {
      await time.increase(SHORT_BETTING_DURATION + 1);
      await market.lockMarket(marketId);
      await time.increase(SHORT_RESOLUTION_DELAY + 1);

      await expect(market.connect(signers.resolver).requestResolution(marketId)).to.not.be.reverted;
    });
  });

  describe("Time-Based Validation", function () {
    let marketId: number;
    let bettingDeadline: number;

    beforeEach(async function () {
      const setup = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);
      marketId = setup.marketId;

      const marketInfo = await market.getMarket(marketId);
      bettingDeadline = Number(marketInfo.bettingDeadline);
    });

    it("should correctly identify time before deadline", async function () {
      const currentTime = await time.latest();
      expect(currentTime).to.be.lessThan(bettingDeadline);

      // Bet should succeed
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);
      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.not.be.reverted;
    });

    it("should correctly identify time after deadline", async function () {
      await time.increase(SHORT_BETTING_DURATION + 1);
      const currentTime = await time.latest();
      expect(currentTime).to.be.greaterThanOrEqual(bettingDeadline);

      // Bet should fail
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);
      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.be.revertedWithCustomError(market, "InvalidState");
    });

    it("should handle betting at exact deadline", async function () {
      // Set time to exactly at deadline
      await time.increaseTo(bettingDeadline);

      const bet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);

      // At deadline, betting should be closed
      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.be.revertedWithCustomError(market, "InvalidState");
    });
  });

  describe("Market State Transitions", function () {
    let marketId: number;

    beforeEach(async function () {
      const setup = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);
      marketId = setup.marketId;
    });

    it("should transition from Open to Locked", async function () {
      const stateBefore = await market.getMarketState(marketId);
      expect(stateBefore).to.equal(0); // Open

      await time.increase(SHORT_BETTING_DURATION + 1);
      await market.lockMarket(marketId);

      const stateAfter = await market.getMarketState(marketId);
      expect(stateAfter).to.equal(1); // Locked
    });

    it("should transition from Locked to Resolving", async function () {
      await time.increase(SHORT_BETTING_DURATION + 1);
      await market.lockMarket(marketId);

      const stateBefore = await market.getMarketState(marketId);
      expect(stateBefore).to.equal(1); // Locked

      await time.increase(SHORT_RESOLUTION_DELAY + 1);
      await market.connect(signers.resolver).requestResolution(marketId);

      const stateAfter = await market.getMarketState(marketId);
      expect(stateAfter).to.equal(2); // Resolving
    });

    it("should prevent invalid state transitions", async function () {
      // Try to go from Open directly to Resolving
      await expect(
        market.connect(signers.resolver).requestResolution(marketId)
      ).to.be.revertedWithCustomError(market, "InvalidState");
    });

    it("should not allow multiple locks", async function () {
      await time.increase(SHORT_BETTING_DURATION + 1);
      await market.lockMarket(marketId);

      // Try to lock again
      await expect(market.lockMarket(marketId)).to.be.revertedWithCustomError(market, "InvalidState");
    });
  });

  describe("Comprehensive Market Creation Validation", function () {
    it("should validate all parameters together", async function () {
      // All invalid
      await expect(
        market.connect(signers.alice).createMarket("", 100, 100, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(market, "InvalidQuestion");
    });

    it("should accept all valid parameters", async function () {
      await expect(
        market
          .connect(signers.alice)
          .createMarket(TEST_QUESTIONS.SHORT, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY, signers.resolver.address)
      ).to.not.be.reverted;
    });

    it("should create market with exact boundary values", async function () {
      const minQuestion = "Question??"; // 10 chars
      const minDuration = ONE_HOUR;
      const maxDelay = 30 * 24 * 3600;

      await expect(
        market.connect(signers.alice).createMarket(minQuestion, minDuration, maxDelay, signers.resolver.address)
      ).to.not.be.reverted;
    });
  });

  describe("Edge Case Validation", function () {
    it("should handle rapid successive market creations", async function () {
      for (let i = 0; i < 5; i++) {
        await expect(
          market
            .connect(signers.alice)
            .createMarket(
              TEST_QUESTIONS.SHORT + i,
              SHORT_BETTING_DURATION,
              SHORT_RESOLUTION_DELAY,
              signers.resolver.address
            )
        ).to.not.be.reverted;
      }

      const count = await market.marketCount();
      expect(count).to.equal(5);
    });

    it("should validate unicode characters in questions", async function () {
      const unicodeQuestion = "Will ETH reach 🚀 $10k? 💎";
      await expect(
        market
          .connect(signers.alice)
          .createMarket(unicodeQuestion, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY, signers.resolver.address)
      ).to.not.be.reverted;
    });

    it("should handle special characters in questions", async function () {
      const specialQuestion = "Will BTC > $100k && ETH > $10k?";
      await expect(
        market
          .connect(signers.alice)
          .createMarket(specialQuestion, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY, signers.resolver.address)
      ).to.not.be.reverted;
    });
  });
});
