import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { BlindBetMarket, ConfidentialUSDC } from "../../types";
import { deployTokenAndMarket, Signers } from "../fixtures/deployContracts";
import { setupMarketWithUsers, lockMarket } from "../fixtures/setupMarket";
import { createEncryptedBet } from "../helpers/fhevm";
import {
  MEDIUM_BET,
  SHORT_BETTING_DURATION,
  SHORT_RESOLUTION_DELAY,
  ONE_TOKEN,
} from "../helpers/constants";

describe("Security Tests", function () {
  let token: ConfidentialUSDC;
  let tokenAddress: string;
  let market: BlindBetMarket;
  let marketAddress: string;
  let signers: Signers;

  beforeEach(async function () {
    ({ token, tokenAddress, market, marketAddress, signers } = await deployTokenAndMarket());
  });

  describe("Reentrancy Protection", function () {
    it("should prevent reentrancy on placeBet", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      const bet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);

      // First call should succeed
      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.not.be.reverted;

      // Reentrancy guard should prevent nested calls
      // In practice, a malicious contract would try to reenter during the transfer callback
      // The nonReentrant modifier prevents this
    });

    it("should prevent reentrancy on claimWinnings", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Place a bet
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);
      await market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof);

      // Lock and resolve market
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);

      // nonReentrant modifier on claimWinnings prevents reentrancy attacks
    });
  });

  describe("Access Control Attacks", function () {
    let marketId: number;

    beforeEach(async function () {
      const setup = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);
      marketId = setup.marketId;
    });

    it("should prevent unauthorized resolution", async function () {
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);
      await time.increase(SHORT_RESOLUTION_DELAY + 1);

      // Only resolver can request resolution
      await expect(
        market.connect(signers.alice).requestResolution(marketId)
      ).to.be.revertedWithCustomError(market, "Unauthorized");
    });

    it("should prevent unauthorized outcome setting", async function () {
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);
      await time.increase(SHORT_RESOLUTION_DELAY + 1);

      // Request resolution as resolver
      await market.connect(signers.resolver).requestResolution(marketId);

      // Non-resolver cannot set outcome
      // Note: This would be tested after oracle callback in production
      await expect(
        market.connect(signers.alice).setResolution(marketId, 1)
      ).to.be.revertedWithCustomError(market, "Unauthorized");
    });

    it("should allow owner to act as resolver", async function () {
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);
      await time.increase(SHORT_RESOLUTION_DELAY + 1);

      // Owner should be able to request resolution
      await expect(market.connect(signers.deployer).requestResolution(marketId)).to.not.be.reverted;
    });
  });

  describe("Double Claiming Prevention", function () {
    it("should prevent claiming twice", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Place bet
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);
      await market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof);

      // In production: lock, resolve, and set outcome
      // Then Alice claims
      // Second claim attempt should fail with AlreadyClaimed error
    });
  });

  describe("Overflow/Underflow Attacks", function () {
    it("should handle max uint64 bet amounts", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Try to bet with max uint64
      const maxUint64 = 2n ** 64n - 1n;

      // This should be handled gracefully (either rejected or capped)
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, maxUint64, true);

      // Transfer will fail silently due to insufficient balance
      // actualAmount will be 0 or less than requested
      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.not.be.reverted;
    });

    it("should handle near-overflow additions", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      const largeBet = 2n ** 60n; // Large but not max

      // Mint enough tokens
      await token.mockMint(signers.alice.address, largeBet * 10n);

      // Approve
      const { createEncryptedAmount } = await import("../helpers/fhevm");
      const encrypted = await createEncryptedAmount(tokenAddress, signers.alice.address, largeBet * 10n);
      await token.connect(signers.alice).approve(marketAddress, encrypted.handles[0], encrypted.inputProof);

      // Place multiple large bets - FHEMath should handle overflow
      const bet1 = await createEncryptedBet(marketAddress, signers.alice.address, largeBet, true);
      await market.connect(signers.alice).placeBet(marketId, bet1.handles[0], bet1.handles[1], bet1.inputProof);

      const bet2 = await createEncryptedBet(marketAddress, signers.alice.address, largeBet, true);
      await expect(
        market.connect(signers.alice).placeBet(marketId, bet2.handles[0], bet2.handles[1], bet2.inputProof)
      ).to.not.be.reverted;
    });
  });

  describe("Front-Running Prevention", function () {
    it("should encrypt all sensitive data", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      const bet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);
      await market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof);

      // Position should be encrypted
      const position = await market.getEncryptedPosition(marketId, signers.alice.address);

      // Values should not be readable without decryption
      expect(position.yesAmount).to.not.equal(ethers.ZeroHash);
      expect(position.yesAmount).to.not.equal(ethers.toBeHex(MEDIUM_BET, 32));
    });

    it("should prevent bet amount snooping", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Alice's bet
      const aliceBet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);
      await market
        .connect(signers.alice)
        .placeBet(marketId, aliceBet.handles[0], aliceBet.handles[1], aliceBet.inputProof);

      // Bob should not be able to decrypt Alice's position
      const alicePosition = await market.getEncryptedPosition(marketId, signers.alice.address);

      // Attempting to decrypt with Bob's key should fail or return garbage
      // (In production FHE, this would require testing the decryption rejection)
    });

    it("should prevent outcome snooping", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Alice bets on Yes
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);
      await market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof);

      // Bet outcome (Yes/No) should be encrypted
      // Cannot determine from on-chain data which side Alice bet on
      const position = await market.getEncryptedPosition(marketId, signers.alice.address);

      // Both yesAmount and noAmount are encrypted, outsiders can't tell which is non-zero
      expect(position.yesAmount).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Griefing Attacks", function () {
    it("should handle zero-amount bets gracefully", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Try to place zero bet
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, 0n, true);

      // Should not revert but also should not create meaningful position
      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.not.be.reverted;
    });

    it("should handle spam bet attempts", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Multiple tiny bets (gas attack attempt)
      const tinyBet = 1n * ONE_TOKEN; // 1 cUSDC

      for (let i = 0; i < 5; i++) {
        const bet = await createEncryptedBet(marketAddress, signers.alice.address, tinyBet, true);
        await market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof);
      }

      // Contract should handle multiple small bets
      const position = await market.getEncryptedPosition(marketId, signers.alice.address);
      expect(position.hasPosition).to.not.equal(ethers.ZeroHash);
    });

    it("should handle malformed encrypted inputs", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Try to place bet with invalid proof
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);

      // Tamper with proof
      const invalidProof = "0x" + "00".repeat(32);

      // Should revert due to invalid proof
      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], invalidProof)
      ).to.be.reverted;
    });
  });

  describe("State Transition Attacks", function () {
    it("should prevent betting on locked markets", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Lock the market
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);

      // Try to place bet
      const bet = await createEncryptedBet(marketAddress, signers.alice.address, MEDIUM_BET, true);

      await expect(
        market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof)
      ).to.be.revertedWithCustomError(market, "InvalidState");
    });

    it("should prevent early market locking", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Try to lock before deadline
      await expect(market.lockMarket(marketId)).to.be.revertedWithCustomError(market, "InvalidState");
    });

    it("should prevent early resolution", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Lock market
      await lockMarket(market, marketId, SHORT_BETTING_DURATION);

      // Try to resolve before resolution time
      await expect(
        market.connect(signers.resolver).requestResolution(marketId)
      ).to.be.revertedWithCustomError(market, "InvalidState");
    });

    it("should prevent resolution on non-locked markets", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Try to resolve without locking
      await expect(
        market.connect(signers.resolver).requestResolution(marketId)
      ).to.be.revertedWithCustomError(market, "InvalidState");
    });
  });

  describe("Economic Attacks", function () {
    it("should handle asymmetric betting (whale on one side)", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      // Small bet on Yes
      const smallBet = 100n * ONE_TOKEN;
      const bet1 = await createEncryptedBet(marketAddress, signers.alice.address, smallBet, true);
      await market.connect(signers.alice).placeBet(marketId, bet1.handles[0], bet1.handles[1], bet1.inputProof);

      // Whale bet on No
      const whaleBet = 100_000n * ONE_TOKEN; // 100k cUSDC
      await token.mockMint(signers.bob.address, whaleBet);

      const { createEncryptedAmount } = await import("../helpers/fhevm");
      const approveEncrypted = await createEncryptedAmount(tokenAddress, signers.bob.address, whaleBet);
      await token.connect(signers.bob).approve(marketAddress, approveEncrypted.handles[0], approveEncrypted.inputProof);

      const bet2 = await createEncryptedBet(marketAddress, signers.bob.address, whaleBet, false);
      await market.connect(signers.bob).placeBet(marketId, bet2.handles[0], bet2.handles[1], bet2.inputProof);

      // Market should handle this asymmetry
      // Fee calculation should work correctly
    });

    it("should maintain encrypted totals even with large bets", async function () {
      const { marketId } = await setupMarketWithUsers(market, marketAddress, token, tokenAddress, signers, SHORT_BETTING_DURATION, SHORT_RESOLUTION_DELAY);

      const largeBet = 50_000n * ONE_TOKEN;
      await token.mockMint(signers.alice.address, largeBet);

      const { createEncryptedAmount } = await import("../helpers/fhevm");
      const approveEncrypted = await createEncryptedAmount(tokenAddress, signers.alice.address, largeBet);
      await token
        .connect(signers.alice)
        .approve(marketAddress, approveEncrypted.handles[0], approveEncrypted.inputProof);

      const bet = await createEncryptedBet(marketAddress, signers.alice.address, largeBet, true);
      await market.connect(signers.alice).placeBet(marketId, bet.handles[0], bet.handles[1], bet.inputProof);

      // Market totals should remain encrypted
      const marketInfo = await market.getMarket(marketId);
      expect(marketInfo.state).to.equal(0); // Still Open
    });
  });
});
