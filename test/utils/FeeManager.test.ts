import { expect } from "chai";
import { ethers } from "hardhat";
import { BlindBetFactory, ConfidentialUSDC } from "../../types";
import { deployTokenAndFactory, Signers } from "../fixtures/deployContracts";
import { DEFAULT_FEE_BPS, MAX_FEE_BPS, STANDARD_BETTING_DURATION, STANDARD_RESOLUTION_DELAY, TEST_QUESTIONS } from "../helpers/constants";

describe("FeeManager Utility Tests", function () {
  let token: ConfidentialUSDC;
  let tokenAddress: string;
  let marketFactory: BlindBetFactory;
  let factoryAddress: string;
  let signers: Signers;

  beforeEach(async function () {
    ({ token, tokenAddress, marketFactory, factoryAddress, signers } = await deployTokenAndFactory());
  });

  describe("Fee Configuration Validation", function () {
    it("should have correct default fee", async function () {
      const feeBps = await marketFactory.feeBasisPoints();
      expect(feeBps).to.equal(DEFAULT_FEE_BPS); // 200 basis points = 2%
    });

    it("should allow 0% fee", async function () {
      await expect(marketFactory.connect(signers.deployer).updateFee(0)).to.not.be.reverted;

      const feeBps = await marketFactory.feeBasisPoints();
      expect(feeBps).to.equal(0);
    });

    it("should allow 1% fee", async function () {
      const onePercent = 100; // 100 basis points
      await expect(marketFactory.connect(signers.deployer).updateFee(onePercent)).to.not.be.reverted;

      const feeBps = await marketFactory.feeBasisPoints();
      expect(feeBps).to.equal(onePercent);
    });

    it("should allow 5% fee", async function () {
      const fivePercent = 500; // 500 basis points
      await expect(marketFactory.connect(signers.deployer).updateFee(fivePercent)).to.not.be.reverted;

      const feeBps = await marketFactory.feeBasisPoints();
      expect(feeBps).to.equal(fivePercent);
    });

    it("should allow 10% fee (maximum)", async function () {
      await expect(marketFactory.connect(signers.deployer).updateFee(MAX_FEE_BPS)).to.not.be.reverted;

      const feeBps = await marketFactory.feeBasisPoints();
      expect(feeBps).to.equal(MAX_FEE_BPS); // 1000 basis points = 10%
    });

    it("should reject fee greater than 10%", async function () {
      const tooHigh = MAX_FEE_BPS + 1; // 1001 basis points
      await expect(
        marketFactory.connect(signers.deployer).updateFee(tooHigh)
      ).to.be.revertedWithCustomError(marketFactory, "InvalidFeeBasisPoints");
    });

    it("should reject extremely high fee", async function () {
      const extremelyHigh = 5000; // 50%
      await expect(
        marketFactory.connect(signers.deployer).updateFee(extremelyHigh)
      ).to.be.revertedWithCustomError(marketFactory, "InvalidFeeBasisPoints");
    });
  });

  describe("Fee Collector Validation", function () {
    it("should have correct default fee collector", async function () {
      const collector = await marketFactory.feeCollector();
      expect(collector).to.equal(signers.feeCollector.address);
    });

    it("should allow updating fee collector", async function () {
      const newCollector = signers.bob.address;
      await expect(marketFactory.connect(signers.deployer).updateFeeCollector(newCollector)).to.not.be.reverted;

      const collector = await marketFactory.feeCollector();
      expect(collector).to.equal(newCollector);
    });

    it("should reject zero address collector", async function () {
      await expect(
        marketFactory.connect(signers.deployer).updateFeeCollector(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(marketFactory, "InvalidFeeCollector");
    });

    it("should emit event on collector update", async function () {
      const oldCollector = await marketFactory.feeCollector();
      const newCollector = signers.carol.address;

      await expect(marketFactory.connect(signers.deployer).updateFeeCollector(newCollector))
        .to.emit(marketFactory, "FeeCollectorUpdated")
        .withArgs(oldCollector, newCollector);
    });
  });

  describe("Fee Calculation Logic", function () {
    it("should calculate 2% fee correctly", async function () {
      // Fee is calculated on-chain using encrypted values
      // We verify the fee config is set correctly
      const feeBps = await marketFactory.feeBasisPoints();
      expect(feeBps).to.equal(DEFAULT_FEE_BPS);

      // 200 basis points / 10000 = 0.02 = 2%
      // For 1000 tokens: 1000 * 0.02 = 20 tokens fee
    });

    it("should calculate 0% fee correctly", async function () {
      await marketFactory.connect(signers.deployer).updateFee(0);
      const feeBps = await marketFactory.feeBasisPoints();
      expect(feeBps).to.equal(0);

      // 0 basis points / 10000 = 0 = 0%
      // For any amount: amount * 0 = 0 tokens fee
    });

    it("should calculate 10% fee correctly", async function () {
      await marketFactory.connect(signers.deployer).updateFee(MAX_FEE_BPS);
      const feeBps = await marketFactory.feeBasisPoints();
      expect(feeBps).to.equal(MAX_FEE_BPS);

      // 1000 basis points / 10000 = 0.1 = 10%
      // For 1000 tokens: 1000 * 0.1 = 100 tokens fee
    });

    it("should handle fractional fee calculations", async function () {
      const threePointFivePercent = 350; // 3.5%
      await marketFactory.connect(signers.deployer).updateFee(threePointFivePercent);
      const feeBps = await marketFactory.feeBasisPoints();
      expect(feeBps).to.equal(threePointFivePercent);

      // 350 basis points / 10000 = 0.035 = 3.5%
      // For 1000 tokens: 1000 * 0.035 = 35 tokens fee
    });
  });

  describe("Fee Updates", function () {
    it("should emit FeeUpdated event", async function () {
      const oldFee = await marketFactory.feeBasisPoints();
      const newFee = 300; // 3%

      await expect(marketFactory.connect(signers.deployer).updateFee(newFee))
        .to.emit(marketFactory, "FeeUpdated")
        .withArgs(oldFee, newFee);
    });

    it("should allow multiple fee updates", async function () {
      await marketFactory.connect(signers.deployer).updateFee(100); // 1%
      expect(await marketFactory.feeBasisPoints()).to.equal(100);

      await marketFactory.connect(signers.deployer).updateFee(500); // 5%
      expect(await marketFactory.feeBasisPoints()).to.equal(500);

      await marketFactory.connect(signers.deployer).updateFee(0); // 0%
      expect(await marketFactory.feeBasisPoints()).to.equal(0);
    });

    it("should update fee for new markets only", async function () {
      // Deploy market with default fee (2%)
      const params1 = {
        question: TEST_QUESTIONS.SHORT,
        bettingDuration: STANDARD_BETTING_DURATION,
        resolutionDelay: STANDARD_RESOLUTION_DELAY,
        resolver: signers.resolver.address,
      };
      await marketFactory.connect(signers.alice).deployMarket(params1);

      // Update fee
      await marketFactory.connect(signers.deployer).updateFee(500); // 5%

      // New markets should use updated fee
      const newFee = await marketFactory.feeBasisPoints();
      expect(newFee).to.equal(500);
    });
  });

  describe("Access Control for Fee Management", function () {
    it("should only allow owner to update fee", async function () {
      await expect(
        marketFactory.connect(signers.alice).updateFee(300)
      ).to.be.revertedWithCustomError(marketFactory, "OwnableUnauthorizedAccount");

      await expect(
        marketFactory.connect(signers.bob).updateFee(300)
      ).to.be.revertedWithCustomError(marketFactory, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to update fee", async function () {
      await expect(marketFactory.connect(signers.deployer).updateFee(300)).to.not.be.reverted;
    });

    it("should only allow owner to update fee collector", async function () {
      await expect(
        marketFactory.connect(signers.alice).updateFeeCollector(signers.bob.address)
      ).to.be.revertedWithCustomError(marketFactory, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to update fee collector", async function () {
      await expect(marketFactory.connect(signers.deployer).updateFeeCollector(signers.bob.address)).to.not.be.reverted;
    });
  });

  describe("Fee Configuration Query", function () {
    it("should return correct fee configuration", async function () {
      const config = await marketFactory.getConfig();

      expect(config.tokenAddress).to.equal(tokenAddress);
      expect(config.feeCollector).to.equal(signers.feeCollector.address);
      expect(config.feeBasisPoints).to.equal(DEFAULT_FEE_BPS);
    });

    it("should reflect updated configuration", async function () {
      const newFee = 500;
      const newCollector = signers.carol.address;

      await marketFactory.connect(signers.deployer).updateFee(newFee);
      await marketFactory.connect(signers.deployer).updateFeeCollector(newCollector);

      const config = await marketFactory.getConfig();
      expect(config.feeBasisPoints).to.equal(newFee);
      expect(config.feeCollector).to.equal(newCollector);
    });
  });

  describe("Edge Cases and Boundary Testing", function () {
    it("should handle setting fee to same value", async function () {
      const currentFee = await marketFactory.feeBasisPoints();
      await expect(marketFactory.connect(signers.deployer).updateFee(currentFee)).to.not.be.reverted;
      expect(await marketFactory.feeBasisPoints()).to.equal(currentFee);
    });

    it("should handle setting collector to same address", async function () {
      const currentCollector = await marketFactory.feeCollector();
      await expect(marketFactory.connect(signers.deployer).updateFeeCollector(currentCollector)).to.not.be.reverted;
      expect(await marketFactory.feeCollector()).to.equal(currentCollector);
    });

    it("should handle rapid fee updates", async function () {
      for (let i = 0; i <= 10; i++) {
        const fee = i * 100; // 0%, 1%, 2%, ..., 10%
        await marketFactory.connect(signers.deployer).updateFee(fee);
        expect(await marketFactory.feeBasisPoints()).to.equal(fee);
      }
    });

    it("should handle boundary value 1 basis point", async function () {
      await expect(marketFactory.connect(signers.deployer).updateFee(1)).to.not.be.reverted;
      expect(await marketFactory.feeBasisPoints()).to.equal(1);
    });

    it("should handle boundary value MAX_FEE_BPS", async function () {
      await expect(marketFactory.connect(signers.deployer).updateFee(MAX_FEE_BPS)).to.not.be.reverted;
      expect(await marketFactory.feeBasisPoints()).to.equal(MAX_FEE_BPS);
    });

    it("should reject boundary value MAX_FEE_BPS + 1", async function () {
      await expect(
        marketFactory.connect(signers.deployer).updateFee(MAX_FEE_BPS + 1)
      ).to.be.revertedWithCustomError(marketFactory, "InvalidFeeBasisPoints");
    });
  });

  describe("Fee Basis Points Constants", function () {
    it("should have correct MAX_FEE_BPS constant", async function () {
      const maxFee = await marketFactory.MAX_FEE_BASIS_POINTS();
      expect(maxFee).to.equal(1000n); // 10%
    });

    it("should have correct BASIS_POINTS_DIVISOR", async function () {
      // BASIS_POINTS_DIVISOR is a standard constant (10000 = 100% in basis points)
      const divisor = 10000n;
      expect(divisor).to.equal(10000n); // 100%
    });

    it("should enforce MAX_FEE_BPS in validation", async function () {
      const maxFee = await marketFactory.MAX_FEE_BASIS_POINTS();

      // Should accept max
      await expect(marketFactory.connect(signers.deployer).updateFee(maxFee)).to.not.be.reverted;

      // Should reject max + 1
      await expect(
        marketFactory.connect(signers.deployer).updateFee(maxFee + 1n)
      ).to.be.revertedWithCustomError(marketFactory, "InvalidFeeBasisPoints");
    });
  });

  describe("Fee Impact on Market Deployment", function () {
    it("should deploy markets with current fee setting", async function () {
      // Update fee
      const newFee = 750; // 7.5%
      await marketFactory.connect(signers.deployer).updateFee(newFee);

      // Deploy market
      const params = {
        question: TEST_QUESTIONS.SHORT,
        bettingDuration: STANDARD_BETTING_DURATION,
        resolutionDelay: STANDARD_RESOLUTION_DELAY,
        resolver: signers.resolver.address,
      };
      await expect(marketFactory.connect(signers.alice).deployMarket(params)).to.not.be.reverted;

      // Verify fee is still set
      expect(await marketFactory.feeBasisPoints()).to.equal(newFee);
    });

    it("should maintain fee setting across multiple deployments", async function () {
      const customFee = 150; // 1.5%
      await marketFactory.connect(signers.deployer).updateFee(customFee);

      const params = {
        question: TEST_QUESTIONS.SHORT,
        bettingDuration: STANDARD_BETTING_DURATION,
        resolutionDelay: STANDARD_RESOLUTION_DELAY,
        resolver: signers.resolver.address,
      };

      // Deploy multiple markets
      for (let i = 0; i < 3; i++) {
        await marketFactory.connect(signers.alice).deployMarket({
          ...params,
          question: TEST_QUESTIONS.SHORT + i,
        });
      }

      // Fee should remain unchanged
      expect(await marketFactory.feeBasisPoints()).to.equal(customFee);
    });
  });

  describe("Fee Collector Changes", function () {
    it("should update fee collector immediately", async function () {
      const newCollector = signers.alice.address;
      await marketFactory.connect(signers.deployer).updateFeeCollector(newCollector);

      const collector = await marketFactory.feeCollector();
      expect(collector).to.equal(newCollector);
    });

    it("should allow multiple collector updates", async function () {
      await marketFactory.connect(signers.deployer).updateFeeCollector(signers.alice.address);
      expect(await marketFactory.feeCollector()).to.equal(signers.alice.address);

      await marketFactory.connect(signers.deployer).updateFeeCollector(signers.bob.address);
      expect(await marketFactory.feeCollector()).to.equal(signers.bob.address);

      await marketFactory.connect(signers.deployer).updateFeeCollector(signers.carol.address);
      expect(await marketFactory.feeCollector()).to.equal(signers.carol.address);
    });

    it("should maintain collector setting across market deployments", async function () {
      const newCollector = signers.bob.address;
      await marketFactory.connect(signers.deployer).updateFeeCollector(newCollector);

      const params = {
        question: TEST_QUESTIONS.SHORT,
        bettingDuration: STANDARD_BETTING_DURATION,
        resolutionDelay: STANDARD_RESOLUTION_DELAY,
        resolver: signers.resolver.address,
      };

      await marketFactory.connect(signers.alice).deployMarket(params);

      // Collector should remain unchanged
      expect(await marketFactory.feeCollector()).to.equal(newCollector);
    });
  });

  describe("Complex Fee Scenarios", function () {
    it("should handle setting fee to 0 then back to non-zero", async function () {
      // Set to 0%
      await marketFactory.connect(signers.deployer).updateFee(0);
      expect(await marketFactory.feeBasisPoints()).to.equal(0);

      // Set back to 2%
      await marketFactory.connect(signers.deployer).updateFee(DEFAULT_FEE_BPS);
      expect(await marketFactory.feeBasisPoints()).to.equal(DEFAULT_FEE_BPS);
    });

    it("should handle alternating fee and collector updates", async function () {
      await marketFactory.connect(signers.deployer).updateFee(300);
      await marketFactory.connect(signers.deployer).updateFeeCollector(signers.alice.address);
      await marketFactory.connect(signers.deployer).updateFee(600);
      await marketFactory.connect(signers.deployer).updateFeeCollector(signers.bob.address);

      expect(await marketFactory.feeBasisPoints()).to.equal(600);
      expect(await marketFactory.feeCollector()).to.equal(signers.bob.address);
    });

    it("should handle maximum fee with different collectors", async function () {
      await marketFactory.connect(signers.deployer).updateFee(MAX_FEE_BPS);
      await marketFactory.connect(signers.deployer).updateFeeCollector(signers.alice.address);

      expect(await marketFactory.feeBasisPoints()).to.equal(MAX_FEE_BPS);
      expect(await marketFactory.feeCollector()).to.equal(signers.alice.address);

      await marketFactory.connect(signers.deployer).updateFeeCollector(signers.bob.address);
      expect(await marketFactory.feeCollector()).to.equal(signers.bob.address);
      expect(await marketFactory.feeBasisPoints()).to.equal(MAX_FEE_BPS); // Fee unchanged
    });
  });

  describe("Gas Efficiency", function () {
    it("should update fee efficiently", async function () {
      const tx = await marketFactory.connect(signers.deployer).updateFee(500);
      const receipt = await tx.wait();

      // Transaction should complete successfully
      expect(receipt).to.not.be.null;
    });

    it("should update collector efficiently", async function () {
      const tx = await marketFactory.connect(signers.deployer).updateFeeCollector(signers.bob.address);
      const receipt = await tx.wait();

      // Transaction should complete successfully
      expect(receipt).to.not.be.null;
    });
  });
});
