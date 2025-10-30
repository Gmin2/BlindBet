import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * BlindBet Tasks - Interact with deployed contracts
 * ==================================================
 *
 * Usage Examples:
 *
 * 1. Mint test tokens:
 *    npx hardhat --network sepolia task:mint --amount 10000
 *
 * 2. Create a market:
 *    npx hardhat --network sepolia task:create-market \
 *      --question "Will ETH reach $5000?" \
 *      --duration 604800 \
 *      --delay 86400 \
 *      --resolver 0xYourResolverAddress
 *
 * 3. View market info:
 *    npx hardhat --network sepolia task:market-info --id 0
 *
 * 4. Place a bet:
 *    npx hardhat --network sepolia task:place-bet \
 *      --market 0 \
 *      --amount 100 \
 *      --outcome yes
 *
 * 5. Lock market:
 *    npx hardhat --network sepolia task:lock-market --id 0
 *
 * 6. Get factory info:
 *    npx hardhat --network sepolia task:factory-info
 */

/**
 * Get deployed contract addresses
 */
task("task:addresses", "Print deployed contract addresses").setAction(async function (
  _taskArguments: TaskArguments,
  hre
) {
  const { deployments } = hre;

  console.log("\nDeployed Contract Addresses:");
  console.log("=".repeat(60));

  try {
    const token = await deployments.get("ConfidentialUSDC");
    console.log("ConfidentialUSDC:", token.address);

    const factory = await deployments.get("BlindBetFactory");
    console.log("BlindBetFactory:", factory.address);
  } catch (error) {
    console.log("No deployments found. Run: npx hardhat deploy --network <network>");
  }

  console.log("=".repeat(60));
});

/**
 * Mint test tokens to your address
 */
task("task:mint", "Mint test ConfidentialUSDC tokens")
  .addParam("amount", "Amount to mint (in cUSDC, e.g., 1000)")
  .addOptionalParam("to", "Recipient address (defaults to deployer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const [signer] = await ethers.getSigners();

    const token = await deployments.get("ConfidentialUSDC");
    const tokenContract = await ethers.getContractAt("ConfidentialUSDC", token.address, signer);

    const recipient = taskArguments.to || signer.address;
    const amount = BigInt(taskArguments.amount) * BigInt(1_000_000); // Convert to 6 decimals

    console.log("\nMinting tokens...");
    console.log("Token:", token.address);
    console.log("Recipient:", recipient);
    console.log("Amount:", taskArguments.amount, "cUSDC");

    const tx = await tokenContract.mint(recipient, amount);
    const receipt = await tx.wait();

    console.log("\nSuccess!");
    console.log("Transaction:", receipt?.hash);
    console.log("Block:", receipt?.blockNumber);
  });

/**
 * Create a new prediction market
 */
task("task:create-market", "Create a new prediction market")
  .addParam("question", "Market question (e.g., 'Will ETH reach $5000?')")
  .addParam("duration", "Betting duration in seconds (e.g., 604800 for 7 days)")
  .addParam("delay", "Resolution delay in seconds (e.g., 86400 for 1 day)")
  .addParam("resolver", "Resolver address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const [signer] = await ethers.getSigners();

    const factory = await deployments.get("BlindBetFactory");
    const factoryContract = await ethers.getContractAt("BlindBetFactory", factory.address, signer);

    console.log("\nCreating market...");
    console.log("Question:", taskArguments.question);
    console.log("Betting duration:", taskArguments.duration, "seconds");
    console.log("Resolution delay:", taskArguments.delay, "seconds");
    console.log("Resolver:", taskArguments.resolver);

    const params = {
      question: taskArguments.question,
      bettingDuration: taskArguments.duration,
      resolutionDelay: taskArguments.delay,
      resolver: taskArguments.resolver,
    };

    const tx = await factoryContract.deployMarket(params);
    const receipt = await tx.wait();

    // Get market count to find the ID
    const marketCount = await factoryContract.marketCount();
    const marketId = marketCount - 1n;

    // Get market address
    const marketAddress = await factoryContract.markets(marketId);

    console.log("\nMarket created!");
    console.log("Market ID:", marketId.toString());
    console.log("Market address:", marketAddress);
    console.log("Transaction:", receipt?.hash);
    console.log("Block:", receipt?.blockNumber);
  });

/**
 * Get market information
 */
task("task:market-info", "Get market information")
  .addParam("id", "Market ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const [signer] = await ethers.getSigners();

    const factory = await deployments.get("BlindBetFactory");
    const factoryContract = await ethers.getContractAt("BlindBetFactory", factory.address, signer);

    const marketId = taskArguments.id;
    const marketAddress = await factoryContract.markets(marketId);

    if (marketAddress === ethers.ZeroAddress) {
      console.log("Market not found!");
      return;
    }

    const marketContract = await ethers.getContractAt("BlindBetMarket", marketAddress, signer);
    const marketInfo = await marketContract.getMarket(0); // Market contracts use internal ID 0

    console.log("\nMarket Information:");
    console.log("=".repeat(60));
    console.log("Market ID:", marketId);
    console.log("Address:", marketAddress);
    console.log("Question:", marketInfo.question);
    console.log("State:", ["Open", "Locked", "Resolving", "Resolved"][marketInfo.state]);
    console.log("Creator:", marketInfo.creator);
    console.log("Resolver:", marketInfo.resolver);
    console.log("\nTimestamps:");
    console.log("Created:", new Date(Number(marketInfo.createdAt) * 1000).toLocaleString());
    console.log("Betting deadline:", new Date(Number(marketInfo.bettingDeadline) * 1000).toLocaleString());
    console.log("Resolution time:", new Date(Number(marketInfo.resolutionTime) * 1000).toLocaleString());

    if (marketInfo.resolvedOutcome > 0) {
      console.log("\nOutcome:", ["NotSet", "Yes", "No", "Invalid"][marketInfo.resolvedOutcome]);
    }
    console.log("=".repeat(60));
  });

/**
 * Get factory information
 */
task("task:factory-info", "Get factory information").setAction(async function (
  _taskArguments: TaskArguments,
  hre
) {
  const { deployments, ethers } = hre;
  const [signer] = await ethers.getSigners();

  const factory = await deployments.get("BlindBetFactory");
  const factoryContract = await ethers.getContractAt("BlindBetFactory", factory.address, signer);

  const token = await deployments.get("ConfidentialUSDC");

  const marketCount = await factoryContract.marketCount();
  const feeCollector = await factoryContract.feeCollector();
  const feeBasisPoints = await factoryContract.feeBasisPoints();

  console.log("\nBlindBetFactory Information:");
  console.log("=".repeat(60));
  console.log("Factory address:", factory.address);
  console.log("Token address:", token.address);
  console.log("Total markets:", marketCount.toString());
  console.log("Fee collector:", feeCollector);
  console.log("Fee:", (Number(feeBasisPoints) / 100).toString() + "%");
  console.log("=".repeat(60));

  if (marketCount > 0) {
    console.log("\nDeployed Markets:");
    for (let i = 0n; i < marketCount; i++) {
      const marketAddress = await factoryContract.markets(i);
      console.log(`  Market ${i}:`, marketAddress);
    }
  }
});

/**
 * Place a bet on a market
 */
task("task:place-bet", "Place a bet on a market")
  .addParam("market", "Market ID")
  .addParam("amount", "Bet amount in cUSDC")
  .addParam("outcome", "Bet outcome: 'yes' or 'no'")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const [signer] = await ethers.getSigners();

    const factory = await deployments.get("BlindBetFactory");
    const factoryContract = await ethers.getContractAt("BlindBetFactory", factory.address, signer);

    const marketId = taskArguments.market;
    const marketAddress = await factoryContract.markets(marketId);

    if (marketAddress === ethers.ZeroAddress) {
      console.log("Market not found!");
      return;
    }

    const token = await deployments.get("ConfidentialUSDC");
    const tokenContract = await ethers.getContractAt("ConfidentialUSDC", token.address, signer);
    const marketContract = await ethers.getContractAt("BlindBetMarket", marketAddress, signer);

    const amount = BigInt(taskArguments.amount) * BigInt(1_000_000); // 6 decimals
    const isYes = taskArguments.outcome.toLowerCase() === "yes";

    console.log("\nPlacing bet...");
    console.log("Market:", marketAddress);
    console.log("Amount:", taskArguments.amount, "cUSDC");
    console.log("Outcome:", isYes ? "Yes" : "No");

    // Create encrypted input
    const input = hre.fhevm.createEncryptedInput(marketAddress, signer.address);
    input.add64(amount);
    input.addBool(isYes);
    const encryptedInput = await input.encrypt();

    // Approve tokens
    console.log("\nApproving tokens...");
    const approveInput = hre.fhevm.createEncryptedInput(token.address, signer.address);
    approveInput.add64(amount);
    const approveEncrypted = await approveInput.encrypt();

    const approveTx = await tokenContract.approve(
      marketAddress,
      approveEncrypted.handles[0],
      approveEncrypted.inputProof
    );
    await approveTx.wait();
    console.log("Tokens approved");

    // Place bet
    console.log("\nPlacing bet...");
    const tx = await marketContract.placeBet(
      0, // Market contracts use internal ID 0
      encryptedInput.handles[0],
      encryptedInput.handles[1],
      encryptedInput.inputProof
    );
    const receipt = await tx.wait();

    console.log("\nBet placed!");
    console.log("Transaction:", receipt?.hash);
    console.log("Block:", receipt?.blockNumber);
  });

/**
 * Lock a market (after betting deadline)
 */
task("task:lock-market", "Lock a market after betting deadline")
  .addParam("id", "Market ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const [signer] = await ethers.getSigners();

    const factory = await deployments.get("BlindBetFactory");
    const factoryContract = await ethers.getContractAt("BlindBetFactory", factory.address, signer);

    const marketId = taskArguments.id;
    const marketAddress = await factoryContract.markets(marketId);

    if (marketAddress === ethers.ZeroAddress) {
      console.log("Market not found!");
      return;
    }

    const marketContract = await ethers.getContractAt("BlindBetMarket", marketAddress, signer);

    console.log("\nLocking market...");
    console.log("Market ID:", marketId);
    console.log("Market address:", marketAddress);

    const tx = await marketContract.lockMarket(0); // Market contracts use internal ID 0
    const receipt = await tx.wait();

    console.log("\nMarket locked!");
    console.log("Transaction:", receipt?.hash);
    console.log("Block:", receipt?.blockNumber);
  });

/**
 * Check token balance
 */
task("task:balance", "Check ConfidentialUSDC balance")
  .addOptionalParam("address", "Address to check (defaults to deployer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const [signer] = await ethers.getSigners();

    const token = await deployments.get("ConfidentialUSDC");
    const tokenContract = await ethers.getContractAt("ConfidentialUSDC", token.address, signer);

    const address = taskArguments.address || signer.address;

    console.log("\nChecking balance...");
    console.log("Token:", token.address);
    console.log("Address:", address);

    // Note: Balance is encrypted, so we can only get the encrypted handle
    const encryptedBalance = await tokenContract.balanceOf(address);

    console.log("\nEncrypted balance handle:", encryptedBalance);
    console.log("Note: Balance is encrypted. Use user decryption to view actual amount.");
  });
