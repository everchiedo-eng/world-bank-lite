/**
 * Minimal on-chain helpers using an EIP-1193 wallet provider.
 *
 * Supports:
 * - WalletConnect EVM wallets
 * - Injected EVM wallets such as MetaMask
 *
 * Supported EVM networks:
 * - Ethereum
 * - BNB Smart Chain
 * - Polygon
 *
 * Solana is handled separately through Phantom.
 */

import { CHAINS, type ChainKind } from "./chains";
import { getWalletConnectProvider } from "./wallet-connect";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Eip1193Provider = {
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Get the currently available EVM provider.
 *
 * Priority:
 * 1. WalletConnect provider
 * 2. Injected provider such as MetaMask
 */
async function getProvider(): Promise<Eip1193Provider> {
  /*
   * First try WalletConnect.
   *
   * EthereumProvider.init() can restore an existing WalletConnect
   * session when available.
   */
  try {
    const provider = await getWalletConnectProvider();

    if (provider?.session) {
      return provider;
    }
  } catch {
    // Fall through to injected provider.
  }

  /*
   * Fall back to MetaMask / injected provider.
   */
  if (
    typeof window !== "undefined" &&
    window.ethereum
  ) {
    return window.ethereum;
  }

  throw new Error(
    "No wallet provider detected. Please connect your wallet first.",
  );
}

/**
 * Make an EIP-1193 request.
 */
async function req(
  method: string,
  params?: unknown[],
): Promise<unknown> {
  const provider = await getProvider();

  return provider.request({
    method,
    params,
  });
}

/* -------------------------------------------------------------------------- */
/* Network                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Add-chain metadata.
 */
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

/**
 * Ensure the wallet is connected to the requested EVM network.
 */
export async function ensureEvmNetwork(
  chain: ChainKind,
): Promise<void> {
  const meta = CHAINS[chain];

  if (!meta.evmChainId) {
    throw new Error(
      `${meta.name} is not an EVM chain`,
    );
  }

  const provider = await getProvider();

  const hexChainId =
    `0x${meta.evmChainId.toString(16)}`;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [
        {
          chainId: hexChainId,
        },
      ],
    });
  } catch (err: unknown) {
    const code =
      (err as { code?: number })?.code;

    if (code === 4902) {
      const params =
        getAddChainParams(chain);

      if (!params) {
        throw new Error(
          `Unable to configure ${meta.name} automatically.`,
        );
      }

      await provider.request({
        method: "wallet_addEthereumChain",
        params: [params],
      });

      return;
    }

    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* Amount conversion                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Convert a decimal amount into blockchain base units.
 *
 * Example:
 *
 * toBaseUnits("1.5", 18)
 *
 * => 1500000000000000000n
 */
export function toBaseUnits(
  amount: string | number,
  decimals: number,
): bigint {
  const s =
    typeof amount === "number"
      ? amount.toString()
      : amount.trim();

  if (!s || Number.isNaN(Number(s))) {
    throw new Error("Invalid amount");
  }

  if (
    !Number.isInteger(decimals) ||
    decimals < 0
  ) {
    throw new Error(
      "Invalid token decimals",
    );
  }

  const negative = s.startsWith("-");

  const unsigned = negative
    ? s.slice(1)
    : s;

  if (!/^\d+(\.\d+)?$/.test(unsigned)) {
    throw new Error("Invalid amount");
  }

  const [whole, fraction = ""] =
    unsigned.split(".");

  if (fraction.length > decimals) {
    throw new Error(
      `Amount has more than ${decimals} decimal places.`,
    );
  }

  const paddedFraction =
    (
      fraction +
      "0".repeat(decimals)
    ).slice(0, decimals);

  const combined =
    `${whole || "0"}${paddedFraction}`;

  const result = BigInt(
    combined.replace(
      /^0+(?=\d)/,
      "",
    ) || "0",
  );

  return negative
    ? -result
    : result;
}

/* -------------------------------------------------------------------------- */
/* ABI encoding                                                               */
/* -------------------------------------------------------------------------- */

function toHexQty(n: bigint): string {
  if (n < 0n) {
    throw new Error(
      "Negative blockchain quantity is not allowed.",
    );
  }

  return `0x${n.toString(16)}`;
}

function pad32(hex: string): string {
  const clean = hex
    .toLowerCase()
    .replace(/^0x/, "");

  if (clean.length > 64) {
    throw new Error(
      "Value exceeds 32 bytes.",
    );
  }

  return clean.padStart(64, "0");
}

function encodeAddress(
  address: string,
): string {
  const clean = address
    .toLowerCase()
    .replace(/^0x/, "");

  if (!/^[0-9a-f]{40}$/.test(clean)) {
    throw new Error(
      "Invalid address.",
    );
  }

  return pad32(clean);
}

function encodeUint(
  n: bigint,
): string {
  if (n < 0n) {
    throw new Error(
      "Unsigned integer cannot be negative.",
    );
  }

  return pad32(
    n.toString(16),
  );
}

function encodeBytes32(
  hex: string,
): string {
  const clean = hex
    .replace(/^0x/, "");

  if (
    !/^[0-9a-fA-F]*$/.test(clean)
  ) {
    throw new Error(
      "Invalid bytes32 value.",
    );
  }

  if (clean.length > 64) {
    throw new Error(
      "bytes32 value is too long.",
    );
  }

  return clean.padEnd(
    64,
    "0",
  );
}

/**
 * Convert UUID into bytes32.
 */
export function uuidToBytes32(
  id: string,
): string {
  const hex = id
    .replace(/-/g, "")
    .toLowerCase();

  if (
    hex.length !== 32 ||
    !/^[0-9a-f]+$/.test(hex)
  ) {
    throw new Error(
      "Invalid UUID.",
    );
  }

  return `0x${hex.padEnd(
    64,
    "0",
  )}`;
}

/* -------------------------------------------------------------------------- */
/* Function selectors                                                         */
/* -------------------------------------------------------------------------- */

const SEL_TRANSFER =
  "a9059cbb";

/*
 * Disburser:
 * disburse(address,address,uint256,bytes32)
 */
const SEL_DISBURSE =
  "85de508d";

/*
 * Disburser:
 * disburseNative(address,uint256,bytes32)
 */
const SEL_DISBURSE_NATIVE =
  "38eaf87e";

/* -------------------------------------------------------------------------- */
/* ERC20 calldata                                                             */
/* -------------------------------------------------------------------------- */

export function encodeErc20Transfer(
  to: string,
  amount: string,
  decimals: number,
): string {
  return (
    `0x${SEL_TRANSFER}` +
    encodeAddress(to) +
    encodeUint(
      toBaseUnits(
        amount,
        decimals,
      ),
    )
  );
}

/* -------------------------------------------------------------------------- */
/* Revert decoding                                                            */
/* -------------------------------------------------------------------------- */

const SEL_ERROR_STRING =
  "0x08c379a0";

const SEL_PANIC =
  "0x4e487b71";

const PANIC_CODES: Record<
  string,
  string
> = {
  "0x01":
    "assertion failed",

  "0x11":
    "arithmetic overflow/underflow",

  "0x12":
    "division or modulo by zero",

  "0x21":
    "invalid enum value",

  "0x22":
    "storage byte array is incorrectly encoded",

  "0x31":
    "pop() on empty array",

  "0x32":
    "array index out of bounds",

  "0x41":
    "allocation too large / out of memory",

  "0x51":
    "call to zero-initialized function",
};

function hexToUtf8(
  hex: string,
): string {
  const clean =
    hex.replace(/^0x/, "");

  let output = "";

  for (
    let i = 0;
    i < clean.length;
    i += 2
  ) {
    const byte =
      parseInt(
        clean.slice(i, i + 2),
        16,
      );

    if (byte !== 0) {
      output += String.fromCharCode(
        byte,
      );
    }
  }

  return output;
}

export function decodeRevertData(
  data?: string | null,
): string | null {
  if (
    !data ||
    typeof data !== "string"
  ) {
    return null;
  }

  const d =
    data.startsWith("0x")
      ? data
      : `0x${data}`;

  if (d.length < 10) {
    return null;
  }

  const selector =
    d.slice(0, 10).toLowerCase();

  /* Error(string) */
  if (
    selector === SEL_ERROR_STRING
  ) {
    try {
      const lengthHex =
        d.slice(
          10 + 64,
          10 + 128,
        );

      const length =
        parseInt(
          lengthHex,
          16,
        );

      const stringHex =
        d.slice(
          10 + 128,
          10 +
            128 +
            length * 2,
        );

      const message =
        hexToUtf8(
          stringHex,
        );

      return message || null;
    } catch {
      return null;
    }
  }

  /* Panic(uint256) */
  if (selector === SEL_PANIC) {
    const code =
      `0x${d.slice(
        10 + 62,
        10 + 64,
      )}`;

    return (
      `Panic(${code}) — ` +
      `${
        PANIC_CODES[code] ??
        "unknown panic"
      }`
    );
  }

  /* Custom error */
  return `Reverted with custom error ${selector}`;
}

/* -------------------------------------------------------------------------- */
/* Provider error handling                                                    */
/* -------------------------------------------------------------------------- */

type ProviderErrorShape = {
  message?: string;
  data?: unknown;
  reason?: string;
  shortMessage?: string;
  error?: {
    message?: string;
    data?: unknown;
  };
  cause?: unknown;
};

function extractProviderError(
  err: unknown,
): {
  message: string;
  data?: string;
} {
  const e =
    err as ProviderErrorShape;

  const buckets = [
    e,
    e?.error,
    e?.cause as
      | ProviderErrorShape
      | undefined,
  ].filter(Boolean) as Array<{
    message?: string;
    data?: unknown;
    reason?: string;
  }>;

  let data:
    | string
    | undefined;

  for (
    const bucket of buckets
  ) {
    const raw =
      bucket?.data;

    if (
      typeof raw === "string" &&
      raw.startsWith("0x")
    ) {
      data = raw;
      break;
    }

    if (
      raw &&
      typeof raw === "object"
    ) {
      const objectData =
        raw as {
          data?: unknown;
          originalError?: {
            data?: unknown;
          };
        };

      const inner =
        objectData.data ??
        objectData
          .originalError?.data;

      if (
        typeof inner ===
          "string" &&
        inner.startsWith("0x")
      ) {
        data = inner;
        break;
      }
    }
  }

  const message =
    e?.shortMessage ||
    e?.reason ||
    e?.message ||
    e?.error?.message ||
    "Transaction failed.";

  return {
    message,
    data,
  };
}

export function humanizeTxError(
  err: unknown,
): string {
  const {
    message,
    data,
  } = extractProviderError(err);

  const code =
    (err as {
      code?: number;
    })?.code;

  if (
    code === 4001 ||
    /user (rejected|denied)/i.test(
      message,
    )
  ) {
    return (
      "You rejected the transaction in your wallet."
    );
  }

  if (
    /insufficient funds/i.test(
      message,
    )
  ) {
    return (
      "Insufficient funds for the transaction or network fees."
    );
  }

  if (/nonce/i.test(message)) {
    return (
      "Nonce mismatch. Reset the wallet activity or retry the transaction."
    );
  }

  const decoded =
    decodeRevertData(data);

  if (decoded) {
    return `Transaction reverted: ${decoded}`;
  }

  if (
    /execution reverted/i.test(
      message,
    )
  ) {
    return (
      "Transaction reverted. Check the contract configuration and available balance."
    );
  }

  return message;
}

/* -------------------------------------------------------------------------- */
/* Account                                                                    */
/* -------------------------------------------------------------------------- */

async function currentAccount(): Promise<string> {
  const accounts =
    (await req(
      "eth_requestAccounts",
    )) as string[];

  if (!accounts?.[0]) {
    throw new Error(
      "No wallet account is connected.",
    );
  }

  return accounts[0];
}

/* -------------------------------------------------------------------------- */
/* Transaction simulation                                                     */
/* -------------------------------------------------------------------------- */

async function simulate(tx: {
  from: string;
  to: string;
  data?: string;
  value?: string;
}): Promise<void> {
  try {
    await req("eth_call", [
      tx,
      "latest",
    ]);
  } catch (err) {
    throw new Error(
      humanizeTxError(err),
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Transaction receipt                                                        */
/* -------------------------------------------------------------------------- */

async function assertMined(
  hash: string,
  chain: ChainKind,
  tx: {
    from: string;
    to: string;
    data?: string;
    value?: string;
  },
): Promise<void> {
  const deadline =
    Date.now() + 90_000;

  while (
    Date.now() < deadline
  ) {
    const receipt =
      (await req(
        "eth_getTransactionReceipt",
        [hash],
      )) as {
        status?: string;
      } | null;

    if (receipt) {
      if (
        receipt.status ===
        "0x1"
      ) {
        return;
      }

      let reason:
        | string
        | null = null;

      try {
        await req(
          "eth_call",
          [
            tx,
            "latest",
          ],
        );
      } catch (err) {
        reason =
          humanizeTxError(
            err,
          );
      }

      const explorer =
        CHAINS[
          chain
        ].explorerTx?.(hash);

      throw new Error(
        `${reason ?? "Transaction reverted on-chain."}` +
          `${
            explorer
              ? ` See ${explorer}`
              : ""
          }`,
      );
    }

    await new Promise<void>(
      (resolve) =>
        setTimeout(
          resolve,
          2500,
        ),
    );
  }

  throw new Error(
    "Transaction is still pending after 90 seconds. Check your wallet or blockchain explorer.",
  );
}

/* -------------------------------------------------------------------------- */
/* Send verified transaction                                                  */
/* -------------------------------------------------------------------------- */

async function sendVerified(
  chain: ChainKind,
  tx: {
    from: string;
    to: string;
    data?: string;
    value?: string;
  },
): Promise<string> {
  await simulate(tx);

  let hash: string;

  try {
    hash =
      (await req(
        "eth_sendTransaction",
        [tx],
      )) as string;
  } catch (err) {
    throw new Error(
      humanizeTxError(err),
    );
  }

  await assertMined(
    hash,
    chain,
    tx,
  );

  return hash;
}

/* -------------------------------------------------------------------------- */
/* Native asset transfer                                                      */
/* -------------------------------------------------------------------------- */

export async function sendNative(
  chain: ChainKind,
  to: string,
  amount: string,
): Promise<string> {
  await ensureEvmNetwork(
    chain,
  );

  const from =
    await currentAccount();

  const value =
    toBaseUnits(
      amount,
      18,
    );

  return sendVerified(
    chain,
    {
      from,
      to,
      value: toHexQty(value),
    },
  );
}

/* -------------------------------------------------------------------------- */
/* ERC20 transfer                                                             */
/* -------------------------------------------------------------------------- */

export async function sendErc20(
  chain: ChainKind,
  token: string,
  to: string,
  amount: string,
  decimals: number,
): Promise<string> {
  await ensureEvmNetwork(
    chain,
  );

  const from =
    await currentAccount();

  const raw =
    toBaseUnits(
      amount,
      decimals,
    );

  const data =
    `0x${SEL_TRANSFER}` +
    encodeAddress(to) +
    encodeUint(raw);

  return sendVerified(
    chain,
    {
      from,
      to: token,
      data,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Native disbursement                                                        */
/* -------------------------------------------------------------------------- */

export async function disburseNative(
  chain: ChainKind,
  disburser: string,
  to: string,
  amount: string,
  loanId: string,
): Promise<string> {
  await ensureEvmNetwork(
    chain,
  );

  const from =
    await currentAccount();

  const raw =
    toBaseUnits(
      amount,
      18,
    );

  const data =
    `0x${SEL_DISBURSE_NATIVE}` +
    encodeAddress(to) +
    encodeUint(raw) +
    encodeBytes32(
      uuidToBytes32(loanId),
    );

  return sendVerified(
    chain,
    {
      from,
      to: disburser,
      data,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* ERC20 disbursement                                                         */
/* -------------------------------------------------------------------------- */

export async function disburseErc20(
  chain: ChainKind,
  disburser: string,
  token: string,
  to: string,
  amount: string,
  decimals: number,
  loanId: string,
): Promise<string> {
  await ensureEvmNetwork(
    chain,
  );

  const from =
    await currentAccount();

  const raw =
    toBaseUnits(
      amount,
      decimals,
    );

  const data =
    `0x${SEL_DISBURSE}` +
    encodeAddress(token) +
    encodeAddress(to) +
    encodeUint(raw) +
    encodeBytes32(
      uuidToBytes32(loanId),
    );

  return sendVerified(
    chain,
    {
      from,
      to: disburser,
      data,
    },
  );
}