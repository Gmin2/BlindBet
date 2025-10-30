import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  console.log("\nDeploying BlindBetFactory...");
  console.log("Deployer address:", deployer);

  // Get ConfidentialUSDC address
  const token = await get("ConfidentialUSDC");

  console.log("Using ConfidentialUSDC at:", token.address);

  // Factory constructor params: tokenAddress, feeCollector, feeBasisPoints
  const feeCollector = deployer; // Deployer receives fees initially
  const feeBasisPoints = 200; // 2% fee (200 basis points)

  const deployedFactory = await deploy("BlindBetFactory", {
    from: deployer,
    args: [token.address, feeCollector, feeBasisPoints], // Constructor: tokenAddress, feeCollector, feeBasisPoints
    log: true,
    waitConfirmations: 1,
  });

  console.log("BlindBetFactory deployed at:", deployedFactory.address);
  console.log("Transaction hash:", deployedFactory.transactionHash);
  console.log("Gas used:", deployedFactory.receipt?.gasUsed.toString());
  console.log("Token address:", token.address);
  console.log("Fee collector:", feeCollector);
  console.log("Fee basis points:", feeBasisPoints, "(2%)");

  return true;
};

export default func;
func.id = "deploy_blindbet_factory";
func.tags = ["BlindBetFactory", "core"];
func.dependencies = ["ConfidentialUSDC"]; // Run after token deployment
