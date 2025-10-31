import { RelayerSDKLoader } from "./loader";

let fhevmInstanceCache: any = null;
let sdkInitialized = false;

async function ensureSDKLoaded() {
  if (typeof window === "undefined") {
    throw new Error("FHEVM SDK can only be used on the client side");
  }

  const loader = RelayerSDKLoader.getInstance();

  // Load the SDK from CDN if not already loaded
  if (!loader.isLoaded()) {
    await loader.load();
  }

  const sdk = loader.getSDK();

  // Initialize SDK if not already initialized
  if (!sdkInitialized && sdk.initSDK) {
    await sdk.initSDK();
    sdkInitialized = true;
  }

  return sdk;
}

export async function getFhevmInstance(): Promise<any> {
  if (fhevmInstanceCache) {
    return fhevmInstanceCache;
  }

  const sdk = await ensureSDKLoaded();

  fhevmInstanceCache = await sdk.createInstance({
    chainId: 11155111, // Sepolia
    gatewayUrl: "https://gateway.sepolia.zama.ai",
  });

  return fhevmInstanceCache;
}

export async function createEncryptedInput(contractAddress: string, userAddress: string) {
  const instance = await getFhevmInstance();
  return instance.createEncryptedInput(contractAddress, userAddress);
}
