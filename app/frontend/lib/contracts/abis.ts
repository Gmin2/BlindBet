// Import compiled contract artifacts from contracts directory
import ConfidentialUSDCArtifact from "../../contracts/ConfidentialUSDC.json";
import BlindBetFactoryArtifact from "../../contracts/BlindBetFactory.json";
import BlindBetMarketArtifact from "../../contracts/BlindBetMarket.json";

export const ABIs = {
  ConfidentialUSDC: ConfidentialUSDCArtifact.abi,
  BlindBetFactory: BlindBetFactoryArtifact.abi,
  BlindBetMarket: BlindBetMarketArtifact.abi,
} as const;

export type ContractName = keyof typeof ABIs;
