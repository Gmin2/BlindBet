// Test constants for BlindBet tests

export const DECIMALS = 6;
export const ONE_TOKEN = 10n ** BigInt(DECIMALS);

// Token amounts
export const INITIAL_MINT = 1_000_000n * ONE_TOKEN; // 1M cUSDC
export const LARGE_BET = 10_000n * ONE_TOKEN; // 10k cUSDC
export const MEDIUM_BET = 1_000n * ONE_TOKEN; // 1k cUSDC
export const SMALL_BET = 100n * ONE_TOKEN; // 100 cUSDC

// Time constants
export const ONE_HOUR = 3600;
export const ONE_DAY = 24 * ONE_HOUR;
export const ONE_WEEK = 7 * ONE_DAY;

// Fee constants
export const DEFAULT_FEE_BPS = 200; // 2%
export const MAX_FEE_BPS = 1000; // 10%
export const BASIS_POINTS = 10000;

// Market durations
export const SHORT_BETTING_DURATION = ONE_HOUR;
export const STANDARD_BETTING_DURATION = ONE_WEEK;
export const SHORT_RESOLUTION_DELAY = ONE_HOUR;
export const STANDARD_RESOLUTION_DELAY = ONE_DAY;

// Market states
export enum MarketState {
  Open = 0,
  Locked = 1,
  Resolving = 2,
  Resolved = 3,
}

// Outcomes
export enum Outcome {
  NotSet = 0,
  Yes = 1,
  No = 2,
  Invalid = 3,
}

// Test questions
export const TEST_QUESTIONS = {
  SHORT: "Will ETH reach $5000?",
  LONG: "Will Bitcoin reach $100,000 by the end of 2024?",
  SPORTS: "Will Team A win the championship?",
  CRYPTO: "Will Ethereum switch to PoS successfully?",
};
