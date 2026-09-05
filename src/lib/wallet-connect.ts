import type { ChainKind } from "./chains";
import { CHAINS } from "./chains";

export type ConnectResult = {
  address: string;
  chain: ChainKind;
};

export type WalletMethod = "walletconnect" | "phantom";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type WalletConnectProvider = {
  session?: unknown;

  connect: (args: {
    chains: number[];
  }) => Promise<unknown>;

  disconnect: () => Promise<unknown>;

  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;

  on?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;

  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
};

type PhantomProvider = {
  isPhantom?: boolean;

  connect: (opts?: {
    onlyIfTrusted?: boolean;
  }) => Promise<{
    publicKey: {
      toString(): string;
    };
  }>;

  disconnect?: () => Promise<unknown>;

  publicKey?: {
    toString(): string;
  };
};

declare global {
  interface Window {
    solana?: PhantomProvider;

    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
    };
  }
}

/* -------------------------------------------------------------------------- */
/* WalletConnect configuration                                                */
/* -------------------------------------------------------------------------- */

const WC_PROJECT_ID =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as
    | string
    | undefined;

let wcProvider: WalletConnectProvider | null = null;

/* -------------------------------------------------------------------------- */
/* WalletConnect provider                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create or reuse the WalletConnect Ethereum provider.
 */
export async function getWalletConnectProvider(): Promise<WalletConnectProvider> {
  if (wcProvider) {
    return wcProvider;
  }

  if (!WC_PROJECT_ID) {
    throw new Error(
      "WalletConnect Project ID is missing. Add VITE_WALLETCONNECT_PROJECT_ID to your .env file.",
    );
  }

  const { EthereumProvider } = await import(
    "@walletconnect/ethereum-provider"
  );

  const provider = await EthereumProvider.init({
    projectId: WC_PROJECT_ID,

    /*
     * Ethereum is the initial required chain.
     */
    chains: [1],

    /*
     * Other supported EVM chains.
     */
    optionalChains: [1, 56, 137],

    showQrModal: true,

    metadata: {
      name: "Chainvault",

      description:
        "Deposit collateral and borrow across supported networks",

      url:
        typeof window !== "undefined"
          ? window.location.origin
          : "https://chainvault.app",

      icons: [],
    },
  });

  wcProvider = provider as WalletConnectProvider;

  return wcProvider;
}

/* -------------------------------------------------------------------------- */
/* WalletConnect reset                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Disconnect the current WalletConnect session and clear
 * cached WalletConnect state.
 */
export async function resetWalletConnect(): Promise<void> {
  try {
    if (wcProvider?.session) {
      try {
        await wcProvider.disconnect();
      } catch {
        // Ignore disconnect errors.
      }
    }
  } finally {
    wcProvider = null;

    if (typeof window !== "undefined") {
      try {
        const keys = Object.keys(window.localStorage);

        for (const key of keys) {
          if (
            key.startsWith("wc@2:") ||
            key.startsWith("walletconnect")
          ) {
            window.localStorage.removeItem(key);
          }
        }
      } catch {
        // Ignore localStorage errors.
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Add-chain metadata                                                         */
/* -------------------------------------------------------------------------- */

function getAddChainParams(
  chain: ChainKind,
): Record<string, unknown> | null {
  const meta = CHAINS[chain];

  if (!meta.evmChainId) {
    return null;
  }

  const chainId = `0x${meta.evmChainId.toString(16)}`;

  switch (chain) {
    case "ethereum":
      return {
        chainId,
        chainName: "Ethereum Mainnet",

        nativeCurrency: {
          name: "Ether",
          symbol: "ETH",
          decimals: 18,
        },

        rpcUrls: [
          "https://ethereum-rpc.publicnode.com",
        ],

        blockExplorerUrls: [
          "https://etherscan.io",
        ],
      };

    case "bnb":
      return {
        chainId,
        chainName: "BNB Smart Chain",

        nativeCurrency: {
          name: "BNB",
          symbol: "BNB",
          decimals: 18,
        },

        rpcUrls: [
          "https://bsc-dataseed.binance.org",
        ],

        blockExplorerUrls: [
          "https://bscscan.com",
        ],
      };

    case "polygon":
      return {
        chainId,
        chainName: "Polygon Mainnet",

        nativeCurrency: {
          name: "POL",
          symbol: "POL",
          decimals: 18,
        },

        rpcUrls: [
          "https://polygon-rpc.com",
        ],

        blockExplorerUrls: [
          "https://polygonscan.com",
        ],
      };

    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* WalletConnect network                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Switch the WalletConnect wallet to the requested EVM network.
 */
export async function switchWalletConnectNetwork(
  chain: ChainKind,
): Promise<void> {
  const meta = CHAINS[chain];

  if (!meta.evmChainId) {
    throw new Error(
      `${meta.name} is not an EVM chain.`,
    );
  }

  const provider =
    await getWalletConnectProvider();

  const chainIdHex =
    `0x${meta.evmChainId.toString(16)}`;

  try {
    await provider.request({
      method:
        "wallet_switchEthereumChain",

      params: [
        {
          chainId: chainIdHex,
        },
      ],
    });
  } catch (error: unknown) {
    const code =
      (error as { code?: number })?.code;

    /*
     * Wallet does not have this chain configured.
     */
    if (code === 4902) {
      const network =
        getAddChainParams(chain);

      if (!network) {
        throw new Error(
          `Unable to configure ${meta.name} automatically.`,
        );
      }

      await provider.request({
        method:
          "wallet_addEthereumChain",

        params: [network],
      });

      /*
       * Some wallets require switching again
       * after adding the network.
       */
      try {
        await provider.request({
          method:
            "wallet_switchEthereumChain",

          params: [
            {
              chainId: chainIdHex,
            },
          ],
        });
      } catch {
        // Some wallets automatically switch after adding.
      }

      return;
    }

    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* WalletConnect connection                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Connect to an EVM network using WalletConnect.
 */
async function connectViaWalletConnect(
  chain: ChainKind,
): Promise<ConnectResult> {
  const meta = CHAINS[chain];

  if (!meta.evmChainId) {
    throw new Error(
      `${meta.name} is not an EVM chain.`,
    );
  }

  const provider =
    await getWalletConnectProvider();

  /*
   * Open WalletConnect QR modal if there is
   * no active WalletConnect session.
   */
  if (!provider.session) {
    await provider.connect({
      chains: [meta.evmChainId],
    });
  }

  /*
   * Request the connected EVM accounts.
   */
  const accounts =
    (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];

  const address =
    accounts?.[0];

  if (!address) {
    throw new Error(
      "Wallet did not return an account.",
    );
  }

  /*
   * Make sure the wallet is on the requested chain.
   */
  await switchWalletConnectNetwork(chain);

  return {
    address,
    chain,
  };
}

/* -------------------------------------------------------------------------- */
/* Public WalletConnect helper                                                */
/* -------------------------------------------------------------------------- */

/**
 * Open the WalletConnect QR modal.
 */
export async function openWalletConnectQr(
  chain: ChainKind = "ethereum",
): Promise<ConnectResult> {
  return connectViaWalletConnect(chain);
}

/* -------------------------------------------------------------------------- */
/* Phantom                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Connect Solana through Phantom.
 */
async function connectSolana(): Promise<ConnectResult> {
  if (typeof window === "undefined") {
    throw new Error(
      "A browser is required to connect Phantom.",
    );
  }

  const phantom =
    window.solana;

  if (!phantom) {
    throw new Error(
      "Phantom wallet is not available. Please install or open Phantom.",
    );
  }

  if (phantom.isPhantom === false) {
    throw new Error(
      "The detected Solana provider is not Phantom.",
    );
  }

  const result =
    await phantom.connect();

  const address =
    result.publicKey.toString();

  if (!address) {
    throw new Error(
      "Phantom did not return a wallet address.",
    );
  }

  return {
    address,
    chain: "solana",
  };
}

/* -------------------------------------------------------------------------- */
/* Public connection API                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Connect to a supported chain.
 */
export async function connectChain(
  chain: ChainKind,
): Promise<ConnectResult> {
  if (chain === "solana") {
    return connectSolana();
  }

  return connectViaWalletConnect(chain);
}

/**
 * Connect using the wallet method selected by the UI.
 */
export async function connectWithMethod(
  chain: ChainKind,
  method: WalletMethod,
): Promise<ConnectResult> {
  /*
   * Solana only supports Phantom in this application.
   */
  if (chain === "solana") {
    if (method !== "phantom") {
      throw new Error(
        "Phantom is the supported Solana wallet.",
      );
    }

    return connectSolana();
  }

  /*
   * EVM chains use WalletConnect.
   */
  if (method !== "walletconnect") {
    throw new Error(
      "WalletConnect is the supported EVM connection method.",
    );
  }

  return connectViaWalletConnect(chain);
}

/* -------------------------------------------------------------------------- */
/* Address helpers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Shorten a wallet address for display.
 *
 * Example:
 * 0x1234567890abcdef -> 0x1234…cdef
 */
export function shortAddress(
  address: string,
): string {
  if (!address) {
    return "";
  }

  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}