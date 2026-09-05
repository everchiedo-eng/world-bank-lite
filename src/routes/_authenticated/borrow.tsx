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
  ArrowRight,
  Wallet as WalletIcon,
  Zap,
  Lock,
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

  const { data: prices = {} } = useQuery({
    queryKey: ["prices-all"],
    queryFn: async () =>
      fetchPrices(
        CHAIN_LIST.flatMap((c) => c.assets.map((a) => a.coingeckoId)),
      ),
    staleTime: 60_000,
  });
const [chain, setChain] = useState<ChainKind>("ethereum");
  const [assetSymbol, setAssetSymbol] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const chainMeta = CHAINS[chain];
  const asset = chainMeta.assets.find((a) => a.symbol === assetSymbol) ?? chainMeta.assets[0];
  const setting = settings.find((s) => s.chain === chain);
  const treasury = setting?.treasury_address ?? "";
  const wallet = wallets.find((w) => w.chain === chain);

  const usdValue = useMemo(() => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return 0;
    return amt * (prices[asset.coingeckoId] ?? 0);
  }, [amount, asset, prices]);

  const tier = loanTier(usdValue);
  const loanUsd = usdValue * tier.multiplier;

  const connect = useMutation({
    mutationFn: async (method: WalletMethod) => {
      const { address } = await connectWithMethod(chain, method);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error } = await supabase
        .from("connected_wallets")
        .upsert({ user_id: user.id, chain, address }, { onConflict: "user_id,chain" });

      if (error) throw error;
      return address;
    },
    onSuccess: () => {
      toast.success(`${chainMeta.name} wallet connected`);
      setPickerOpen(false);
      qc.invalidateQueries({ queryKey: ["wallets"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to connect");
    },
  });

  const deposit = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Enter an amount greater than 0");
      if (usdValue < 10) throw new Error("Minimum \$10 deposit");
      if (!wallet) throw new Error(`Connect your ${chainMeta.name} wallet first`);
      if (!treasury) throw new Error(`${chainMeta.name} deposits unavailable`);

      // Treasury is used here for the logic, but not logged to console
      let txHash: string;
      if (asset.tokenAddress) {
        txHash = await sendErc20(chain, asset.tokenAddress, treasury, amount, asset.decimals);
      } else {
        txHash = await sendNative(chain, treasury, amount);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error: depErr, data: dep } = await supabase
        .from("collateral_deposits")
        .insert({
          user_id: user.id,
          chain,
          asset: asset.symbol,
          amount: amt,
          usd_value_at_deposit: Number(usdValue.toFixed(2)),
          from_address: wallet.address,
          to_address: treasury, // Internal database record
          deposit_tx_hash: txHash,
        })
        .select().single();

      if (depErr) throw depErr;

      const dueAt = new Date();
      dueAt.setMonth(dueAt.getMonth() + tier.termMonths);

      const { error: loanErr } = await supabase.from("loans").insert({
        user_id: user.id,
        collateral_deposit_id: dep.id,
        borrow_asset: asset.symbol,
        borrow_chain: chain,
        requested_amount_usd: Number(loanUsd.toFixed(2)),
        ltv_percent: Number((tier.multiplier * 100).toFixed(2)),
        leverage_multiplier: tier.multiplier,
        term_months: tier.termMonths,
        repayment_due_at: dueAt.toISOString(),
        destination_address: wallet.address,
      });

      if (loanErr) throw loanErr;
      return txHash;
    },
    onSuccess: (txHash) => {
      toast.success("Deposit confirmed — loan disbursement is automatic.");
      setAmount("");
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => {
      setConfirmOpen(false);
      toast.error(e instanceof Error ? e.message : "Deposit failed");
    },
  });

  return (
    <AppShell title="Borrow">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-elegant">
          <h2 className="mb-1 font-display text-lg font-semibold">Choose collateral</h2>
          <p className="mb-5 text-xs text-muted-foreground">Pick the chain and asset to deposit.</p>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Chain</span>
                <select
                  value={chain}
                  onChange={(e) => {
                    const c = e.target.value as ChainKind;
                    setChain(c);
                    setAssetSymbol(CHAINS[c].assets[0].symbol);
                  }}
                  className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none"
                >
                  {CHAIN_LIST.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <div className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Asset</span>
                <div className="flex flex-wrap gap-2">
                  {chainMeta.assets.map((a) => (
                    <button
                      key={a.symbol}
                      onClick={() => setAssetSymbol(a.symbol)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition ${
                        a.symbol === assetSymbol ? "border-primary bg-primary/10" : "border-border/60"
                      }`}
                    >
                      {a.symbol}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-widest text-muted-foreground">Amount</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2.5 font-mono text-lg"
              />
            </label>

            {wallet ? (
              <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/5 p-3 text-xs">
                <span className="text-success">Connected: {shortAddress(wallet.address)}</span>
                <Link to="/wallets" className="text-primary hover:underline">Change</Link>
              </div>
            ) : (
              <button onClick={() => setPickerOpen(true)} className="w-full py-2.5 rounded-lg border border-primary/40 text-primary text-sm font-medium">
                Connect {chainMeta.name} wallet
              </button>
            )}

            <button
              onClick={() => (wallet ? setConfirmOpen(true) : setPickerOpen(true))}
              disabled={deposit.isPending || usdValue <= 0}
              className="w-full py-2.5 rounded-lg bg-gradient-primary text-primary-foreground font-semibold shadow-elegant"
            >
              {deposit.isPending ? <Loader2 className="animate-spin inline mr-2" size={14} /> : <Send className="inline mr-2" size={14} />}
              Deposit collateral
            </button>
          </div>
        </section>

        <aside className="rounded-2xl border border-accent/30 bg-gradient-surface p-6 shadow-elegant">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">You will receive</div>
          <div className="mt-2 font-display text-3xl font-semibold">
            \${loanUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="mt-5 space-y-2 text-xs">
            <Row label="Deposit value" value={`\$${usdValue.toFixed(2)}`} />
            <Row label="Leverage" value={`${tier.multiplier}×`} />
            <Row label="Term" value={`${tier.termMonths} months`} />
          </div>
        </aside>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !deposit.isPending && setConfirmOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-6" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-lg font-semibold">Confirm Deposit</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Depositing {amount} {asset.symbol} (≈ \${usdValue.toFixed(2)}) on {chainMeta.name}.
            </p>
            {/* The treasury address is hidden from this modal view */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmOpen(false)} className="py-2 text-sm rounded-lg border border-border/60">Cancel</button>
              <button onClick={() => deposit.mutate()} className="py-2 text-sm rounded-lg bg-gradient-primary text-primary-foreground font-semibold">
                {deposit.isPending && <Loader2 className="animate-spin inline mr-2" size={14} />}
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      <WalletPickerModal
        open={pickerOpen}
        chain={chain}
        busy={connect.isPending}
        onCancel={() => setPickerOpen(false)}
        onPick={(m) => connect.mutate(m)}
      />
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}