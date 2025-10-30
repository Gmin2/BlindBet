import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\nDeploying ConfidentialUSDC...");
  console.log("Deployer address:", deployer);

  const deployedToken = await deploy("ConfidentialUSDC", {
    from: deployer,
    args: [deployer], // Constructor: owner address (receives initial supply)
    log: true,
    waitConfirmations: 1,
  });

  console.log("ConfidentialUSDC deployed at:", deployedToken.address);
  console.log("Transaction hash:", deployedToken.transactionHash);
  console.log("Gas used:", deployedToken.receipt?.gasUsed.toString());

  // Save deployment info
  console.log("\nSaving deployment artifacts...");

  return true;
};

export default func;
func.id = "deploy_confidential_usdc";
func.tags = ["ConfidentialUSDC", "tokens"];
