const SDK_CDN_URL = "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs";

export interface RelayerSDK {
  initSDK: () => Promise<void>;
  createInstance: (config: { chainId: number; gatewayUrl: string }) => Promise<any>;
  __initialized__?: boolean;
}

declare global {
  interface Window {
    relayerSDK?: RelayerSDK;
  }
}

export class RelayerSDKLoader {
  private static instance: RelayerSDKLoader | null = null;
  private loadPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): RelayerSDKLoader {
    if (!RelayerSDKLoader.instance) {
      RelayerSDKLoader.instance = new RelayerSDKLoader();
    }
    return RelayerSDKLoader.instance;
  }

  public isLoaded(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    return !!window.relayerSDK;
  }

  public async load(): Promise<void> {
    // Return existing load promise if already loading
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Ensure this only runs in the browser
    if (typeof window === "undefined") {
      throw new Error("RelayerSDKLoader: can only be used in the browser");
    }

    // Already loaded
    if (this.isLoaded()) {
      return Promise.resolve();
    }

    // Create and cache the load promise
    this.loadPromise = new Promise((resolve, reject) => {
      // Check if script already exists
      const existingScript = document.querySelector(`script[src="${SDK_CDN_URL}"]`);
      if (existingScript) {
        if (this.isLoaded()) {
          resolve();
        } else {
          reject(new Error("RelayerSDKLoader: Script loaded but window.relayerSDK is invalid"));
        }
        return;
      }

      // Create and append script
      const script = document.createElement("script");
      script.src = SDK_CDN_URL;
      script.type = "text/javascript";
      script.async = true;

      script.onload = () => {
        if (!this.isLoaded()) {
          reject(new Error("RelayerSDKLoader: Script loaded but window.relayerSDK is invalid"));
        } else {
          resolve();
        }
      };

      script.onerror = () => {
        reject(new Error(`RelayerSDKLoader: Failed to load SDK from ${SDK_CDN_URL}`));
      };

      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  public getSDK(): RelayerSDK {
    if (typeof window === "undefined" || !window.relayerSDK) {
      throw new Error("RelayerSDK not loaded. Call load() first.");
    }
    return window.relayerSDK;
  }
}
