import { time } from "@nomicfoundation/hardhat-network-helpers";
import { BlindBetMarket, ConfidentialUSDC } from "../../types";
import { Signers } from "./deployContracts";
import {
  STANDARD_BETTING_DURATION,
  STANDARD_RESOLUTION_DELAY,
  INITIAL_MINT,
  TEST_QUESTIONS,
} from "../helpers/constants";
import { createEncryptedAmount } from "../helpers/fhevm";

/**
 * Create a test market with default parameters
 */
export async function createTestMarket(
  market: BlindBetMarket,
  resolver: string,
  creator: Signers["alice"],
  question: string = TEST_QUESTIONS.SHORT,
  bettingDuration: number = STANDARD_BETTING_DURATION,
  resolutionDelay: number = STANDARD_RESOLUTION_DELAY
): Promise<number> {
  const tx = await market
    .connect(creator)
    .createMarket(question, bettingDuration, resolutionDelay, resolver);
  await tx.wait();

  const marketCount = await market.marketCount();
  return Number(marketCount) - 1; // Return the marketId
}

/**
 * Mint tokens to test users
 */
export async function mintTokensToUsers(
  token: ConfidentialUSDC,
  users: Signers["alice"][]
) {
  for (const user of users) {
    await token.mockMint(user.address, INITIAL_MINT);
  }
}

/**
 * Approve market to spend tokens for users
 */
export async function approveMarketForUsers(
  token: ConfidentialUSDC,
  tokenAddress: string,
  marketAddress: string,
  users: Signers["alice"][],
  amount: bigint = INITIAL_MINT
) {
  for (const user of users) {
    const encrypted = await createEncryptedAmount(tokenAddress, user.address, amount);
    const tx = await token
      .connect(user)
      .approve(marketAddress, encrypted.handles[0], encrypted.inputProof);
    await tx.wait();
  }
}

/**
 * Setup complete market with users ready to bet
 */
export async function setupMarketWithUsers(
  market: BlindBetMarket,
  marketAddress: string,
  token: ConfidentialUSDC,
  tokenAddress: string,
  signers: Signers,
  bettingDuration: number = STANDARD_BETTING_DURATION,
  resolutionDelay: number = STANDARD_RESOLUTION_DELAY
) {
  const users = [signers.alice, signers.bob, signers.carol];

  // Mint tokens
  await mintTokensToUsers(token, users);

  // Approve market
  await approveMarketForUsers(token, tokenAddress, marketAddress, users);

  // Create market
  const marketId = await createTestMarket(market, signers.resolver.address, signers.alice, TEST_QUESTIONS.SHORT, bettingDuration, resolutionDelay);

  return { marketId, users };
}

/**
 * Advance time past betting deadline
 */
export async function advancePastBettingDeadline(bettingDuration: number) {
  await time.increase(bettingDuration + 1);
}

/**
 * Advance time past resolution time
 */
export async function advancePastResolutionTime(bettingDuration: number, resolutionDelay: number) {
  await time.increase(bettingDuration + resolutionDelay + 1);
}

/**
 * Lock market after deadline
 */
export async function lockMarket(market: BlindBetMarket, marketId: number, bettingDuration: number) {
  await advancePastBettingDeadline(bettingDuration);
  const tx = await market.lockMarket(marketId);
  await tx.wait();
}
