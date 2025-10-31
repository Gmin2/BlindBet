export const CONTRACTS = {
  sepolia: {
    ConfidentialUSDC: "0x51c783E4Ae64a7bC3af8eb7ef63B26e0E0507F49",
    BlindBetFactory: "0xc5e6b52e328c1399aAeDC2018F5a7274e5038C24",
  },
  localhost: {
    ConfidentialUSDC: process.env.NEXT_PUBLIC_TOKEN_ADDRESS_LOCALHOST || "",
    BlindBetFactory: process.env.NEXT_PUBLIC_FACTORY_ADDRESS_LOCALHOST || "",
  },
} as const;

export function getContractAddress(
  network: "sepolia" | "localhost",
  contract: "ConfidentialUSDC" | "BlindBetFactory",
): string {
  return CONTRACTS[network][contract];
}



