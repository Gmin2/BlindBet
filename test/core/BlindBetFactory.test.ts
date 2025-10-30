import { expect } from "chai";
import { ethers } from "hardhat";
import { BlindBetFactory, ConfidentialUSDC } from "../../types";
import { deployTokenAndFactory, Signers } from "../fixtures/deployContracts";
import {
  DEFAULT_FEE_BPS,
  MAX_FEE_BPS,
  STANDARD_BETTING_DURATION,
  STANDARD_RESOLUTION_DELAY,
  TEST_QUESTIONS,
  ONE_HOUR,
} from "../helpers/constants";

describe("BlindBetFactory", function () {
  let token: ConfidentialUSDC;
  let tokenAddress: string;
  let marketFactory: BlindBetFactory;
  let factoryAddress: string;
  let signers: Signers;

  beforeEach(async function () {
    ({ token, tokenAddress, marketFactory, factoryAddress, signers } = await deployTokenAndFactory());
  });

  describe("Deployment", function () {
    it("should deploy with correct token address", async function () {
      const deployedTokenAddress = await marketFactory.tokenAddress();
      expect(deployedTokenAddress).to.equal(tokenAddress);
    });

    it("should set initial fee collector", async function () {
      const feeCollector = await marketFactory.feeCollector();
      expect(feeCollector).to.equal(signers.feeCollector.address);
    });

    it("should set initial fee basis points", async function () {
      const feeBps = await marketFactory.feeBasisPoints();
      expect(feeBps).to.equal(DEFAULT_FEE_BPS);
    });

    it("should set default durations", async function () {
      const minBetting = await marketFactory.minBettingDuration();
      const maxBetting = await marketFactory.maxBettingDuration();
      const minResolution = await marketFactory.minResolutionDelay();

      expect(minBetting).to.equal(ONE_HOUR);
      expect(maxBetting).to.equal(365 * 24 * 3600); // 365 days
      expect(minResolution).to.equal(ONE_HOUR);
    });

    it("should set owner correctly", async function () {
      const owner = await marketFactory.owner();
      expect(owner).to.equal(signers.deployer.address);
    });

    it("should initialize market count to 0", async function () {
      const count = await marketFactory.marketCount();
      expect(count).to.equal(0);
    });
  });

  describe("Market Deployment", function () {
    const question = TEST_QUESTIONS.SHORT;

    it("should deploy new market", async function () {
      const params = {
        question,
        bettingDuration: STANDARD_BETTING_DURATION,
        resolutionDelay: STANDARD_RESOLUTION_DELAY,
        resolver: signers.resolver.address,
      };

      const tx = await marketFactory.connect(signers.alice).deployMarket(params);
      const receipt = await tx.wait();

      expect(receipt).to.not.be.undefined;
    });

    it("should increment market count", async function () {
      const params = {
        question,
        bettingDuration: STANDARD_BETTING_DURATION,
        resolutionDelay: STANDARD_RESOLUTION_DELAY,
        resolver: signers.resolver.address,
      };

      await marketFactory.connect(signers.alice).deployMarket(params);

      const count = await marketFactory.marketCount();
      expect(count).to.equal(1);
    });

    it("should store market address mapping", async function () {
      const params = {
        question,
        bettingDuration: STANDARD_BETTING_DURATION,
        resolutionDelay: STANDARD_RESOLUTION_DELAY,
        resolver: signers.resolver.address,
      };

      const tx = await marketFactory.connect(signers.alice).deployMarket(params);
      await tx.wait();

      const marketAddress = await marketFactory.getMarketAddress(0);
      expect(marketAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should store market ID mapping", async function () {
      const params = {
        question,
        bettingDuration: STANDARD_BETTING_DURATION,
        resolutionDelay: STANDARD_RESOLUTION_DELAY,
        resolver: signers.resolver.address,
      };

      const tx = await marketFactory.connect(signers.alice).deployMarket(params);
      await tx.wait();

      const marketAddress = await marketFactory.getMarketAddress(0);
      const marketId = await marketFactory.getMarketId(marketAddress);
      expect(marketId).to.equal(0);
    });

    it("should emit MarketDeployed event", async function () {
      const params = {
        question,
        bettingDuration: STANDARD_BETTING_DURATION,
        resolutionDelay: STANDARD_RESOLUTION_DELAY,
        resolver: signers.resolver.address,
      };

      const tx = await marketFactory.connect(signers.alice).deployMarket(params);
      const receipt = await tx.wait();

      // Get the deployed market address after deployment
      const marketAddress = await marketFactory.getMarketAddress(0);

      await expect(tx)
        .to.emit(marketFactory, "MarketDeployed")
        .withArgs(
          marketAddress,
          0, // marketId
          question,
          signers.alice.address
        );
    });

    it("should allow multiple market deployments", async function () {
      const params1 = {
        question: TEST_QUESTIONS.SHORT,
        bettingDuration: STANDARD_BETTING_DURATION,
        resolutionDelay: STANDARD_RESOLUTION_DELAY,
        resolver: signers.resolver.address,
      };

      const params2 = {
        question: TEST_QUESTIONS.LONG,
        bettingDuration: STANDARD_BETTING_DURATION,
        resolutionDelay: STANDARD_RESOLUTION_DELAY,
        resolver: signers.resolver.address,
      };

      await marketFactory.connect(signers.alice).deployMarket(params1);
      await marketFactory.connect(signers.bob).deployMarket(params2);

      const count = await marketFactory.marketCount();
      expect(count).to.equal(2);
    });

    describe("Validation", function () {
      it("should reject empty question", async function () {
        const params = {
          question: "",
          bettingDuration: STANDARD_BETTING_DURATION,
          resolutionDelay: STANDARD_RESOLUTION_DELAY,
          resolver: signers.resolver.address,
        };

        await expect(
          marketFactory.connect(signers.alice).deployMarket(params)
        ).to.be.revertedWithCustomError(marketFactory, "InvalidQuestion");
      });

      it("should reject betting duration too short", async function () {
        const params = {
          question,
          bettingDuration: 1800, // 30 minutes
          resolutionDelay: STANDARD_RESOLUTION_DELAY,
          resolver: signers.resolver.address,
        };

        await expect(
          marketFactory.connect(signers.alice).deployMarket(params)
        ).to.be.revertedWithCustomError(marketFactory, "InvalidDuration");
      });

      it("should reject betting duration too long", async function () {
        const params = {
          question,
          bettingDuration: 366 * 24 * 3600, // More than 365 days
          resolutionDelay: STANDARD_RESOLUTION_DELAY,
          resolver: signers.resolver.address,
        };

        await expect(
          marketFactory.connect(signers.alice).deployMarket(params)
        ).to.be.revertedWithCustomError(marketFactory, "InvalidDuration");
      });

      it("should reject resolution delay too short", async function () {
        const params = {
          question,
          bettingDuration: STANDARD_BETTING_DURATION,
          resolutionDelay: 1800, // 30 minutes
          resolver: signers.resolver.address,
        };

        await expect(
          marketFactory.connect(signers.alice).deployMarket(params)
        ).to.be.revertedWithCustomError(marketFactory, "InvalidDuration");
      });

      it("should reject zero resolver address", async function () {
        const params = {
          question,
          bettingDuration: STANDARD_BETTING_DURATION,
          resolutionDelay: STANDARD_RESOLUTION_DELAY,
          resolver: ethers.ZeroAddress,
        };

        await expect(
          marketFactory.connect(signers.alice).deployMarket(params)
        ).to.be.revertedWithCustomError(marketFactory, "InvalidResolver");
      });
    });
  });

  describe("Market Queries", function () {
    beforeEach(async function () {
      const params = {
        question: TEST_QUESTIONS.SHORT,
        bettingDuration: STANDARD_BETTING_DURATION,
        resolutionDelay: STANDARD_RESOLUTION_DELAY,
        resolver: signers.resolver.address,
      };

      await marketFactory.connect(signers.alice).deployMarket(params);
    });

    it("should return market address by ID", async function () {
      const marketAddress = await marketFactory.getMarketAddress(0);
      expect(marketAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("should return market ID by address", async function () {
      const marketAddress = await marketFactory.getMarketAddress(0);
      const marketId = await marketFactory.getMarketId(marketAddress);
      expect(marketId).to.equal(0);
    });

    it("should return total market count", async function () {
      const count = await marketFactory.getMarketCount();
      expect(count).to.equal(1);
    });

    it("should return factory configuration", async function () {
      const config = await marketFactory.getConfig();
      expect(config.tokenAddress).to.equal(tokenAddress);
      expect(config.feeCollector).to.equal(signers.feeCollector.address);
      expect(config.feeBasisPoints).to.equal(DEFAULT_FEE_BPS);
    });

    it("should reject queries for non-existent markets", async function () {
      await expect(
        marketFactory.getMarketAddress(999)
      ).to.be.revertedWithCustomError(marketFactory, "MarketNotFound");
    });

    it("should reject getMarketId for invalid address", async function () {
      await expect(
        marketFactory.getMarketId(signers.alice.address)
      ).to.be.revertedWithCustomError(marketFactory, "MarketNotFound");
    });
  });

  describe("Configuration Management", function () {
    describe("Implementation Updates", function () {
      it("should allow owner to update implementation", async function () {
        const newImpl = signers.bob.address;

        const tx = await marketFactory.connect(signers.deployer).updateImplementation(newImpl);
        await tx.wait();

        const implementation = await marketFactory.implementation();
        expect(implementation).to.equal(newImpl);
      });

      it("should emit ImplementationUpdated event", async function () {
        const newImpl = signers.bob.address;
        const oldImpl = await marketFactory.implementation();

        await expect(
          marketFactory.connect(signers.deployer).updateImplementation(newImpl)
        )
          .to.emit(marketFactory, "ImplementationUpdated")
          .withArgs(oldImpl, newImpl);
      });

      it("should reject zero address", async function () {
        await expect(
          marketFactory.connect(signers.deployer).updateImplementation(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(marketFactory, "InvalidImplementation");
      });

      it("should reject non-owner calls", async function () {
        await expect(
          marketFactory.connect(signers.alice).updateImplementation(signers.bob.address)
        ).to.be.revertedWithCustomError(marketFactory, "OwnableUnauthorizedAccount");
      });
    });

    describe("Fee Updates", function () {
      it("should allow owner to update fee", async function () {
        const newFee = 500; // 5%

        const tx = await marketFactory.connect(signers.deployer).updateFee(newFee);
        await tx.wait();

        const feeBps = await marketFactory.feeBasisPoints();
        expect(feeBps).to.equal(newFee);
      });

      it("should emit FeeUpdated event", async function () {
        const newFee = 500;
        const oldFee = await marketFactory.feeBasisPoints();

        await expect(marketFactory.connect(signers.deployer).updateFee(newFee))
          .to.emit(marketFactory, "FeeUpdated")
          .withArgs(oldFee, newFee);
      });

      it("should reject fees > 10%", async function () {
        await expect(
          marketFactory.connect(signers.deployer).updateFee(MAX_FEE_BPS + 1)
        ).to.be.revertedWithCustomError(marketFactory, "InvalidFeeBasisPoints");
      });

      it("should allow 0% fee", async function () {
        const tx = await marketFactory.connect(signers.deployer).updateFee(0);
        await tx.wait();

        const feeBps = await marketFactory.feeBasisPoints();
        expect(feeBps).to.equal(0);
      });

      it("should allow 10% fee (max)", async function () {
        const tx = await marketFactory.connect(signers.deployer).updateFee(MAX_FEE_BPS);
        await tx.wait();

        const feeBps = await marketFactory.feeBasisPoints();
        expect(feeBps).to.equal(MAX_FEE_BPS);
      });

      it("should reject non-owner calls", async function () {
        await expect(
          marketFactory.connect(signers.alice).updateFee(300)
        ).to.be.revertedWithCustomError(marketFactory, "OwnableUnauthorizedAccount");
      });
    });

    describe("Fee Collector Updates", function () {
      it("should allow owner to update collector", async function () {
        const newCollector = signers.bob.address;

        const tx = await marketFactory.connect(signers.deployer).updateFeeCollector(newCollector);
        await tx.wait();

        const collector = await marketFactory.feeCollector();
        expect(collector).to.equal(newCollector);
      });

      it("should emit FeeCollectorUpdated event", async function () {
        const newCollector = signers.bob.address;
        const oldCollector = await marketFactory.feeCollector();

        await expect(
          marketFactory.connect(signers.deployer).updateFeeCollector(newCollector)
        )
          .to.emit(marketFactory, "FeeCollectorUpdated")
          .withArgs(oldCollector, newCollector);
      });

      it("should reject zero address", async function () {
        await expect(
          marketFactory.connect(signers.deployer).updateFeeCollector(ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(marketFactory, "InvalidFeeCollector");
      });

      it("should reject non-owner calls", async function () {
        await expect(
          marketFactory.connect(signers.alice).updateFeeCollector(signers.bob.address)
        ).to.be.revertedWithCustomError(marketFactory, "OwnableUnauthorizedAccount");
      });
    });
  });

  describe("Access Control", function () {
    it("should only allow owner to update config", async function () {
      await expect(
        marketFactory.connect(signers.alice).updateFee(300)
      ).to.be.revertedWithCustomError(marketFactory, "OwnableUnauthorizedAccount");

      await expect(
        marketFactory.connect(signers.alice).updateFeeCollector(signers.bob.address)
      ).to.be.revertedWithCustomError(marketFactory, "OwnableUnauthorizedAccount");

      await expect(
        marketFactory.connect(signers.alice).updateImplementation(signers.bob.address)
      ).to.be.revertedWithCustomError(marketFactory, "OwnableUnauthorizedAccount");
    });

    it("should allow anyone to deploy markets", async function () {
      const params = {
        question: TEST_QUESTIONS.SHORT,
        bettingDuration: STANDARD_BETTING_DURATION,
        resolutionDelay: STANDARD_RESOLUTION_DELAY,
        resolver: signers.resolver.address,
      };

      // Alice deploys
      await expect(marketFactory.connect(signers.alice).deployMarket(params)).to.not.be.reverted;

      // Bob deploys
      await expect(marketFactory.connect(signers.bob).deployMarket(params)).to.not.be.reverted;

      const count = await marketFactory.marketCount();
      expect(count).to.equal(2);
    });
  });
});
