import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  ConfidentialUSDC,
  ConfidentialUSDC__factory,
  BlindBetMarket,
  BlindBetMarket__factory,
  BlindBetFactory,
  BlindBetFactory__factory,
} from "../../types";
import { DEFAULT_FEE_BPS } from "../helpers/constants";

export type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
  resolver: HardhatEthersSigner;
  feeCollector: HardhatEthersSigner;
};

export async function getSigners(): Promise<Signers> {
  const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
  return {
    deployer: ethSigners[0],
    alice: ethSigners[1],
    bob: ethSigners[2],
    carol: ethSigners[3],
    resolver: ethSigners[4],
    feeCollector: ethSigners[5],
  };
}

export async function deployToken(deployer: HardhatEthersSigner) {
  const factory = (await ethers.getContractFactory("ConfidentialUSDC", deployer)) as ConfidentialUSDC__factory;
  const token = (await factory.deploy(deployer.address)) as ConfidentialUSDC;
  const tokenAddress = await token.getAddress();
  return { token, tokenAddress };
}

export async function deployMarket(tokenAddress: string, deployer: HardhatEthersSigner) {
  const factory = (await ethers.getContractFactory("BlindBetMarket", deployer)) as BlindBetMarket__factory;
  const market = (await factory.deploy(tokenAddress)) as BlindBetMarket;
  const marketAddress = await market.getAddress();
  return { market, marketAddress };
}

export async function deployFactory(
  tokenAddress: string,
  feeCollector: string,
  deployer: HardhatEthersSigner
) {
  const factory = (await ethers.getContractFactory("BlindBetFactory", deployer)) as BlindBetFactory__factory;
  const marketFactory = (await factory.deploy(
    tokenAddress,
    feeCollector,
    DEFAULT_FEE_BPS
  )) as BlindBetFactory;
  const factoryAddress = await marketFactory.getAddress();
  return { marketFactory, factoryAddress };
}

export async function deployAll(signers: Signers) {
  // Deploy token
  const { token, tokenAddress } = await deployToken(signers.deployer);

  // Deploy market
  const { market, marketAddress } = await deployMarket(tokenAddress, signers.deployer);

  // Deploy factory
  const { marketFactory, factoryAddress } = await deployFactory(
    tokenAddress,
    signers.feeCollector.address,
    signers.deployer
  );

  return {
    token,
    tokenAddress,
    market,
    marketAddress,
    marketFactory,
    factoryAddress,
  };
}

export async function deployTokenAndMarket() {
  const signers = await getSigners();
  const { token, tokenAddress } = await deployToken(signers.deployer);
  const { market, marketAddress } = await deployMarket(tokenAddress, signers.deployer);

  return {
    token,
    tokenAddress,
    market,
    marketAddress,
    signers,
  };
}

export async function deployTokenAndFactory() {
  const signers = await getSigners();
  const { token, tokenAddress } = await deployToken(signers.deployer);
  const { marketFactory, factoryAddress } = await deployFactory(
    tokenAddress,
    signers.feeCollector.address,
    signers.deployer
  );

  return {
    token,
    tokenAddress,
    marketFactory,
    factoryAddress,
    signers,
  };
}
