import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { get } = hre.deployments;

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));

  try {
    const token = await get("ConfidentialUSDC");
    console.log("\nConfidentialUSDC:");
    console.log("  Address:", token.address);
    console.log("  Block:", token.receipt?.blockNumber);

    const factory = await get("BlindBetFactory");
    console.log("\nBlindBetFactory:");
    console.log("  Address:", factory.address);
    console.log("  Block:", factory.receipt?.blockNumber);

    console.log("\n" + "=".repeat(60));
    console.log("NEXT STEPS:");
    console.log("=".repeat(60));
    console.log("\n1. Update contract addresses in frontend:");
    console.log("   - Copy addresses above to your .env or config file");
    console.log("\n2. Verify contracts on block explorer (if deploying to testnet/mainnet):");
    console.log("   npx hardhat verify --network <network> " + token.address + " <deployer_address>");
    console.log("   npx hardhat verify --network <network> " + factory.address + " " + token.address + " <fee_collector> 200");
    console.log("\n3. Interact with contracts:");
    console.log("   - Use BlindBetFactory to create markets");
    console.log("   - Factory address:", factory.address);
    console.log("\n" + "=".repeat(60));

    // Write addresses to a JSON file for easy access
    const fs = require("fs");
    const path = require("path");

    const addresses = {
      network: hre.network.name,
      timestamp: new Date().toISOString(),
      contracts: {
        ConfidentialUSDC: token.address,
        BlindBetFactory: factory.address,
      },
    };

    const deploymentsDir = path.join(__dirname, "../deployments");
    const addressesFile = path.join(deploymentsDir, `${hre.network.name}-addresses.json`);

    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    fs.writeFileSync(addressesFile, JSON.stringify(addresses, null, 2));
    console.log("\nAddresses saved to:", addressesFile);

  } catch (error) {
    console.error("\nError retrieving deployment information:", error);
  }

  return true;
};

export default func;
func.id = "deployment_summary";
func.tags = ["Summary"];
func.dependencies = ["ConfidentialUSDC", "BlindBetFactory"];
func.runAtTheEnd = true;
