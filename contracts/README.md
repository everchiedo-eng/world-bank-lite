# Disburser — deploy guide

Minimal owner-gated payout contract that Chainvault calls when the admin
approves a loan. You (the treasury signer) deploy one instance per testnet,
paste each address into **Admin → Chain settings** in the app, and fund each
deployment with test tokens.

> ⚠️ Testnet only. This contract has no rate limits, no oracles, and no
> repayment enforcement. Do not deploy to mainnet with real funds.

## Chains enabled in v1

| Chain             | Chain ID   | Faucet                                     |
| ----------------- | ---------- | ------------------------------------------ |
| Ethereum Sepolia  | 11155111   | https://cloud.google.com/application/web3/faucet/ethereum/sepolia |
| BNB Smart Chain testnet | 97   | https://www.bnbchain.org/en/testnet-faucet |

Test USDC on Sepolia (Circle): `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
Test BUSD/USDT on BSC testnet: use any BEP-20 test token you mint yourself
(the contract works with any standard ERC-20).

## Option A — Deploy via Remix (fastest, no CLI)

1. Open https://remix.ethereum.org
2. Create `Disburser.sol` in the file explorer, paste the contents of
   [`Disburser.sol`](./Disburser.sol).
3. **Solidity compiler tab** → compiler version `0.8.24`, click **Compile**.
4. **Deploy & Run** tab → Environment: **Injected Provider — Trust Wallet**
   (or MetaMask). Switch your wallet to the target testnet first.
5. Click **Deploy**. Confirm in your wallet. Copy the deployed address.
6. Repeat for every testnet you want live.

## Option B — Foundry (scriptable)

```bash
# one-time
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge init chainvault-disburser --no-git
cp contracts/Disburser.sol chainvault-disburser/src/

cd chainvault-disburser
forge build

# Sepolia
forge create src/Disburser.sol:Disburser \
  --rpc-url https://sepolia.infura.io/v3/<KEY> \
  --private-key <TREASURY_PRIVATE_KEY> \
  --broadcast

# BSC testnet
forge create src/Disburser.sol:Disburser \
  --rpc-url https://data-seed-prebsc-1-s1.binance.org:8545 \
  --private-key <TREASURY_PRIVATE_KEY> \
  --broadcast
```

## Wiring the addresses into the app

1. Sign in as the admin account (first user registered).
2. Open **Admin → Chain settings**.
3. For each chain, paste:
   - **Treasury address** — the wallet that receives user collateral deposits.
     This is your Trust Wallet address for that chain (or a dedicated cold
     wallet you own).
   - **Disburser address** — the contract you just deployed.
   - **RPC URL** — public RPC is fine on testnet.
4. Save. The Borrow page will now show your treasury address to users and
   send their deposit transaction to it.

## Funding the Disburser

After deployment:

1. Get test ETH/BNB from a faucet.
2. Send some to the Disburser address so it can pay native loans.
3. Get test USDC/BUSD from a faucet or mint your own test ERC-20, and send
   some to the Disburser so it can pay stablecoin loans.

The admin approval flow in the app will pop your Trust Wallet to sign
`disburseNative(to, amount, loanId)` or `disburse(token, to, amount, loanId)`
against the deployed contract. The tx hash is stored on the loan row.
