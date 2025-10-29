import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { fhevm } from "hardhat";

/**
 * Create encrypted input for betting
 */
export async function createEncryptedBet(
  contractAddress: string,
  userAddress: string,
  amount: bigint,
  outcome: boolean
) {
  const input = fhevm.createEncryptedInput(contractAddress, userAddress);
  input.add64(amount);
  input.addBool(outcome);
  return await input.encrypt();
}

/**
 * Create encrypted input for token amount
 */
export async function createEncryptedAmount(
  contractAddress: string,
  userAddress: string,
  amount: bigint
) {
  const input = fhevm.createEncryptedInput(contractAddress, userAddress);
  input.add64(amount);
  return await input.encrypt();
}

/**
 * Decrypt euint64 value
 */
export async function decryptEuint64(
  encryptedValue: string,
  contractAddress: string,
  signer: HardhatEthersSigner
): Promise<bigint> {
  return await fhevm.userDecryptEuint(
    FhevmType.euint64,
    encryptedValue,
    contractAddress,
    signer
  );
}

/**
 * Decrypt ebool value
 */
export async function decryptEbool(
  encryptedValue: string,
  contractAddress: string,
  signer: HardhatEthersSigner
): Promise<boolean> {
  return await fhevm.userDecryptEbool(
    encryptedValue,
    contractAddress,
    signer
  );
}

/**
 * Check if encrypted value is initialized (not zero hash)
 */
export function isInitialized(encryptedValue: string): boolean {
  return encryptedValue !== "0x0000000000000000000000000000000000000000000000000000000000000000";
}
