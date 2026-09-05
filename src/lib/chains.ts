export type ChainKind =
  | "ethereum"
  | "bnb"
  | "polygon"
  | "solana";

export type ChainAsset = {
  symbol: string;
  name: string;
  decimals: number;
  coingeckoId: string;
  logoUrl: string;
  tokenAddress?: string;
  standard: "Native" | "ERC-20" | "BEP-20" | "SPL";
};

export type ChainMeta = {
  id: ChainKind;
  name: string;
  networkLabel: string;
  color: string;
  evmChainId?: number;
  explorerTx?: (hash: string) => string;
  assets: ChainAsset[];
};

export const CHAINS: Record<ChainKind, ChainMeta> = {
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    networkLabel: "Mainnet",
    color: "#627EEA",
    evmChainId: 1,
    explorerTx: (hash) => `https://etherscan.io/tx/${hash}`,

    assets: [
      {
        symbol: "ETH",
        name: "Ether",
        decimals: 18,
        coingeckoId: "ethereum",
        logoUrl:
          "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
        standard: "Native",
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        coingeckoId: "usd-coin",
        logoUrl:
          "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
        tokenAddress:
          "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        standard: "ERC-20",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        coingeckoId: "tether",
        logoUrl:
          "https://assets.coingecko.com/coins/images/325/small/Tether.png",
        tokenAddress:
          "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        standard: "ERC-20",
      },
    ],
  },

  bnb: {
    id: "bnb",
    name: "BNB Smart Chain",
    networkLabel: "Mainnet",
    color: "#F3BA2F",
    evmChainId: 56,
    explorerTx: (hash) => `https://bscscan.com/tx/${hash}`,

    assets: [
      {
        symbol: "BNB",
        name: "BNB",
        decimals: 18,
        coingeckoId: "binancecoin",
        logoUrl:
          "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
        standard: "Native",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        decimals: 18,
        coingeckoId: "tether",
        logoUrl:
          "https://assets.coingecko.com/coins/images/325/small/Tether.png",
        tokenAddress:
          "0x55d398326f99059fF775485246999027B3197955",
        standard: "BEP-20",
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        decimals: 18,
        coingeckoId: "usd-coin",
        logoUrl:
          "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
        tokenAddress:
          "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
        standard: "BEP-20",
      },
    ],
  },

  polygon: {
    id: "polygon",
    name: "Polygon",
    networkLabel: "Mainnet",
    color: "#8247E5",
    evmChainId: 137,
    explorerTx: (hash) => `https://polygonscan.com/tx/${hash}`,

    assets: [
      {
        symbol: "POL",
        name: "POL",
        decimals: 18,
        coingeckoId: "matic-network",
        logoUrl:
          "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
        standard: "Native",
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        coingeckoId: "usd-coin",
        logoUrl:
          "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
        tokenAddress:
          "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        standard: "ERC-20",
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        coingeckoId: "tether",
        logoUrl:
          "https://assets.coingecko.com/coins/images/325/small/Tether.png",
        tokenAddress:
          "0xc2132D05D31c914a87C6611C10748AaCbA6D4d1A",
        standard: "ERC-20",
      },
    ],
  },

  solana: {
    id: "solana",
    name: "Solana",
    networkLabel: "Mainnet",
    color: "#9945FF",

    assets: [
      {
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        coingeckoId: "solana",
        logoUrl:
          "https://assets.coingecko.com/coins/images/4128/small/solana.png",
        standard: "Native",
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        coingeckoId: "usd-coin",
        logoUrl:
          "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
        standard: "SPL",
      },
    ],
  },
};

export const CHAIN_LIST: ChainMeta[] = Object.values(CHAINS);

export const ALL_CHAINS: ChainMeta[] = CHAIN_LIST;

export const ENABLED_CHAINS: ChainMeta[] = CHAIN_LIST.filter(
  (chain) => chain.evmChainId !== undefined,
);

export type ChainPrices = Record<string, number>;

/**
 * Demo prices.
 *
 * These are used by the prototype until you connect
 * a real price API/oracle.
 */
export async function fetchPrices(
  ids?: string[],
): Promise<ChainPrices> {
  const prices: ChainPrices = {
    ethereum: 3000,
    binancecoin: 650,
    "matic-network": 0.25,
    solana: 150,
    "usd-coin": 1,
    tether: 1,
  };

  if (!ids) {
    return prices;
  }

  return Object.fromEntries(
    ids.map((id) => [id, prices[id] ?? 0]),
  );
}

/**
 * Loan configuration.
 *
 * IMPORTANT:
 *
 * multiplier = 7 means 7×.
 *
 * Examples:
 *
 * $1 deposited     → $7 loan
 * $100 deposited   → $700 loan
 * $1,000 deposited → $7,000 loan
 * $3,000 deposited → $21,000 loan
 *
 * This is 7×, NOT 7%.
 */
export type LoanTier = {
  multiplier: number;
  termMonths: number;
};

export function loanTier(usdValue: number): LoanTier {
  if (!Number.isFinite(usdValue) || usdValue <= 0) {
    return {
      multiplier: 0,
      termMonths: 0,
    };
  }

  if (usdValue < 100_000) {
    return {
      multiplier: 7,
      termMonths: 12,
    };
  }

  return {
    multiplier: 7,
    termMonths: 24,
  };
}