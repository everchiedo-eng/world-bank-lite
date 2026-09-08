import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import {
  CHAIN_LIST,
  CHAINS,
  fetchPrices,
  loanTier,
  type ChainKind,
} from "@/lib/chains";
import { sendErc20, sendNative } from "@/lib/onchain";
import {
  shortAddress,
  connectWithMethod,
  type WalletMethod,
} from "@/lib/wallet-connect";
import { WalletPickerModal } from "@/components/wallet-picker-modal";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import {
  Loader2,
  Send,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/borrow")({
  head: () => ({ meta: [{ title: "Borrow — Chainvault" }] }),
  component: Borrow,
});

function Borrow() {
  const qc = useQueryClient();

  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets"],
    queryFn: async () =>
      (await supabase.from("connected_wallets").select("*")).data ?? [],
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["chain-settings"],
    queryFn: async () =>
      (await supabase.from("chain_settings").select("*")).data ?? [],
  });

  // Live crypto prices
  const {
    data: prices = {},
    isFetching: pricesFetching,
  } = useQuery({
    queryKey: ["prices-all"],
    queryFn: async () =>
      fetchPrices(
        CHAIN_LIST.flatMap((c) =>
          c.assets.map((a) => a.coingeckoId),
        ),
      ),
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });

  const [chain, setChain] = useState<ChainKind>("ethereum");
  const [assetSymbol, setAssetSymbol] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const chainMeta = CHAINS[chain];

  const asset =
    chainMeta.assets.find((a) => a.symbol === assetSymbol) ??
    chainMeta.assets[0];

  const setting = settings.find((s) => s.chain === chain);

  const treasury = setting?.treasury_address ?? "";

  const wallet = wallets.find((w) => w.chain === chain);

  const currentPrice = prices[asset.coingeckoId] ?? 0;

  const usdValue = useMemo(() => {
    const amt = Number(amount);

    if (!amt || amt <= 0) return 0;

    return amt * (prices[asset.coingeckoId] ?? 0);
  }, [amount, asset, prices]);

  const tier = loanTier(usdValue);

  const loanUsd = usdValue * tier.multiplier;

  const formatPrice = (price: number) => {
    if (!price || price <= 0) return "Price unavailable";

    return `$${price.toLocaleString(undefined, {
      minimumFractionDigits: price < 1 ? 4 : 2,
      maximumFractionDigits: price < 1 ? 6 : 2,
    })}`;
  };

  const connect = useMutation({
    mutationFn: async (method: WalletMethod) => {
      const { address } = await connectWithMethod(chain, method);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not signed in");
      }

      const { error } = await supabase
        .from("connected_wallets")
        .upsert(
          {
            user_id: user.id,
            chain,
            address,
          },
          {
            onConflict: "user_id,chain",
          },
        );

      if (error) {
        throw error;
      }

      return address;
    },

    onSuccess: () => {
      toast.success(`${chainMeta.name} wallet connected`);

      setPickerOpen(false);

      qc.invalidateQueries({
        queryKey: ["wallets"],
      });
    },

    onError: (e) => {
      toast.error(
        e instanceof Error
          ? e.message
          : "Failed to connect",
      );
    },
  });

  const deposit = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);

      if (!amt || amt <= 0) {
        throw new Error("Enter an amount greater than 0");
      }

      if (usdValue < 10) {
        throw new Error("Minimum $10 deposit");
      }

      if (!wallet) {
        throw new Error(
          `Connect your ${chainMeta.name} wallet first`,
        );
      }

      if (!treasury) {
        throw new Error(
          `${chainMeta.name} deposits unavailable`,
        );
      }

      let txHash: string;

      if (asset.tokenAddress) {
        txHash = await sendErc20(
          chain,
          asset.tokenAddress,
          treasury,
          amount,
          asset.decimals,
        );
      } else {
        txHash = await sendNative(
          chain,
          treasury,
          amount,
        );
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not signed in");
      }

      const {
        error: depErr,
        data: dep,
      } = await supabase
        .from("collateral_deposits")
        .insert({
          user_id: user.id,
          chain,
          asset: asset.symbol,
          amount: amt,
          usd_value_at_deposit: Number(
            usdValue.toFixed(2),
          ),
          from_address: wallet.address,
          to_address: treasury,
          deposit_tx_hash: txHash,
        })
        .select()
        .single();

      if (depErr) {
        throw depErr;
      }

      const dueAt = new Date();

      dueAt.setMonth(
        dueAt.getMonth() + tier.termMonths,
      );

      const {
        error: loanErr,
      } = await supabase
        .from("loans")
        .insert({
          user_id: user.id,
          collateral_deposit_id: dep.id,
          borrow_asset: asset.symbol,
          borrow_chain: chain,
          requested_amount_usd: Number(
            loanUsd.toFixed(2),
          ),
          ltv_percent: Number(
            (tier.multiplier * 100).toFixed(2),
          ),
          leverage_multiplier: tier.multiplier,
          term_months: tier.termMonths,
          repayment_due_at: dueAt.toISOString(),
          destination_address: wallet.address,
        });

      if (loanErr) {
        throw loanErr;
      }

      return txHash;
    },

    onSuccess: () => {
      toast.success(
        "Deposit confirmed — loan disbursement is automatic.",
      );

      setAmount("");

      setConfirmOpen(false);

      qc.invalidateQueries({
        queryKey: ["dashboard"],
      });
    },

    onError: (e) => {
      setConfirmOpen(false);

      toast.error(
        e instanceof Error
          ? e.message
          : "Deposit failed",
      );
    },
  });

  return (
    <AppShell title="Borrow">
      <div className="grid gap-6 lg:grid-cols-2">

        {/* LEFT SIDE */}
        <section className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-elegant">

          <h2 className="mb-1 font-display text-lg font-semibold">
            Choose collateral
          </h2>

          <p className="mb-5 text-xs text-muted-foreground">
            Pick the chain and asset to deposit.
          </p>

          <div className="space-y-4">

            {/* CHAIN + ASSET */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* CHAIN */}
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">
                  Chain
                </span>

                <select
                  value={chain}
                  onChange={(e) => {
                    const c =
                      e.target.value as ChainKind;

                    setChain(c);

                    setAssetSymbol(
                      CHAINS[c].assets[0].symbol,
                    );
                  }}
                  className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none"
                >
                  {CHAIN_LIST.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* ASSET */}
              <div className="block">

                <div className="mb-1.5 flex items-center justify-between">

                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    Asset
                  </span>

                  <span className="text-[10px] text-muted-foreground">
                    {pricesFetching
                      ? "Updating..."
                      : "Live prices"}
                  </span>

                </div>

                <div className="grid grid-cols-2 gap-2">
                  {chainMeta.assets.map((a) => {
                    const price =
                      prices[a.coingeckoId];

                    return (
                      <button
                        key={a.symbol}
                        type="button"
                        onClick={() =>
                          setAssetSymbol(a.symbol)
                        }
                        className={`rounded-xl border p-3 text-left transition ${
                          a.symbol === assetSymbol
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border/60 bg-background/30 hover:border-primary/40"
                        }`}
                      >

                        <div className="flex items-center justify-between">

                          <span className="text-sm font-semibold">
                            {a.symbol}
                          </span>

                          {a.symbol === assetSymbol && (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          )}

                        </div>

                        <div className="mt-1 font-mono text-xs text-muted-foreground">
                          {price != null
                            ? formatPrice(price)
                            : "Loading..."}
                        </div>

                      </button>
                    );
                  })}
                </div>

              </div>

            </div>

            {/* AMOUNT */}
            <label className="block">

              <span className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">
                Amount
              </span>

              <input
                type="number"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value)
                }
                placeholder="0.00"
                min="0"
                step="any"
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2.5 font-mono text-lg"
              />

            </label>

            {/* CURRENT LIVE PRICE */}
            <div className="rounded-xl border border-border/50 bg-background/30 p-3">

              <div className="flex items-center justify-between">

                <span className="text-xs text-muted-foreground">
                  Current {asset.symbol} price
                </span>

                <span className="font-mono text-sm font-semibold">
                  {currentPrice > 0
                    ? formatPrice(currentPrice)
                    : "Loading..."}
                </span>

              </div>

              <div className="mt-1 flex items-center justify-between">

                <span className="text-[10px] text-muted-foreground">
                  Market price
                </span>

                <span className="text-[10px] text-muted-foreground">
                  {pricesFetching
                    ? "Updating..."
                    : "Updates every 15 seconds"}
                </span>

              </div>

            </div>

            {/* USD VALUE */}
            {Number(amount) > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">

                <div className="flex items-center justify-between">

                  <span className="text-xs text-muted-foreground">
                    Collateral value
                  </span>

                  <span className="font-mono text-sm font-semibold">
                    ${usdValue.toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}
                  </span>

                </div>

                <div className="mt-1 text-[10px] text-muted-foreground">
                  {amount} {asset.symbol} ×{" "}
                  {formatPrice(currentPrice)}
                </div>

              </div>
            )}

            {/* WALLET */}
            {wallet ? (

              <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/5 p-3 text-xs">

                <span className="text-success">
                  Connected:{" "}
                  {shortAddress(
                    wallet.address,
                  )}
                </span>

                <Link
                  to="/wallets"
                  className="text-primary hover:underline"
                >
                  Change
                </Link>

              </div>

            ) : (

              <button
                type="button"
                onClick={() =>
                  setPickerOpen(true)
                }
                className="w-full rounded-lg border border-primary/40 py-2.5 text-sm font-medium text-primary"
              >
                Connect {chainMeta.name} wallet
              </button>

            )}

            {/* DEPOSIT */}
            <button
              type="button"
              onClick={() =>
                wallet
                  ? setConfirmOpen(true)
                  : setPickerOpen(true)
              }
              disabled={
                deposit.isPending ||
                usdValue <= 0
              }
              className="w-full rounded-lg bg-gradient-primary py-2.5 font-semibold text-primary-foreground shadow-elegant disabled:cursor-not-allowed disabled:opacity-50"
            >

              {deposit.isPending ? (
                <Loader2
                  className="mr-2 inline animate-spin"
                  size={14}
                />
              ) : (
                <Send
                  className="mr-2 inline"
                  size={14}
                />
              )}

              Deposit collateral

            </button>

          </div>
        </section>

        {/* RIGHT SIDE */}
        <aside className="rounded-2xl border border-accent/30 bg-gradient-surface p-6 shadow-elegant">

          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            You will receive
          </div>

          <div className="mt-2 font-display text-3xl font-semibold">
            ${loanUsd.toLocaleString(
              undefined,
              {
                maximumFractionDigits: 2,
              },
            )}
          </div>

          <div className="mt-5 space-y-2 text-xs">

            <Row
              label="Deposit value"
              value={`$${usdValue.toFixed(2)}`}
            />

            <Row
              label="Leverage"
              value={`${tier.multiplier}×`}
            />

            <Row
              label="Term"
              value={`${tier.termMonths} months`}
            />

            <Row
              label="Asset"
              value={asset.symbol}
            />

            <Row
              label="Live price"
              value={formatPrice(currentPrice)}
            />

          </div>

        </aside>
      </div>

      {/* CONFIRM MODAL */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() =>
            !deposit.isPending &&
            setConfirmOpen(false)
          }
        >

          <div
            className="w-full max-w-sm rounded-2xl bg-background p-6"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <div className="font-display text-lg font-semibold">
              Confirm Deposit
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Depositing{" "}
              <span className="font-medium text-foreground">
                {amount} {asset.symbol}
              </span>{" "}
              (≈ ${usdValue.toFixed(2)}) on{" "}
              {chainMeta.name}.
            </p>

            <div className="mt-3 rounded-lg border border-border/50 bg-background/40 p-3">

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Current price
                </span>

                <span className="font-mono font-semibold">
                  {formatPrice(currentPrice)}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Loan amount
                </span>

                <span className="font-mono font-semibold">
                  ${loanUsd.toFixed(2)}
                </span>
              </div>

            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">

              <button
                type="button"
                onClick={() =>
                  setConfirmOpen(false)
                }
                disabled={deposit.isPending}
                className="rounded-lg border border-border/60 py-2 text-sm"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  deposit.mutate()
                }
                disabled={deposit.isPending}
                className="rounded-lg bg-gradient-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >

                {deposit.isPending && (
                  <Loader2
                    className="mr-2 inline animate-spin"
                    size={14}
                  />
                )}

                Accept

              </button>

            </div>

          </div>
        </div>
      )}

      {/* WALLET PICKER */}
      <WalletPickerModal
        open={pickerOpen}
        chain={chain}
        busy={connect.isPending}
        onCancel={() =>
          setPickerOpen(false)
        }
        onPick={(m) =>
          connect.mutate(m)
        }
      />

    </AppShell>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">

      <span className="text-muted-foreground">
        {label}
      </span>

      <span className="font-medium">
        {value}
      </span>

    </div>
  );
}