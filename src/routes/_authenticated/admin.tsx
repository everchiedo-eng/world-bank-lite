import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { ALL_CHAINS, CHAINS, ENABLED_CHAINS, type ChainKind } from "@/lib/chains";
import { disburseErc20, disburseNative } from "@/lib/onchain";
import { shortAddress } from "@/lib/wallet-connect";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, ShieldCheck, Check, X, Send, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Chainvault" }] }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: Admin,
});

function Admin() {
  const qc = useQueryClient();

  const { data: loans = [] } = useQuery({
    queryKey: ["admin-loans"],
    queryFn: async () => (await supabase.from("loans").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: deposits = [] } = useQuery({
    queryKey: ["admin-deposits"],
    queryFn: async () => (await supabase.from("collateral_deposits").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["admin-chain-settings"],
    queryFn: async () => (await supabase.from("chain_settings").select("*")).data ?? [],
  });

  const decide = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: "approved" | "rejected"; notes?: string }) => {
      const { error } = await supabase.from("loans").update({
        status,
        admin_notes: notes ?? null,
        decided_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Loan updated");
      qc.invalidateQueries({ queryKey: ["admin-loans"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const disburse = useMutation({
    mutationFn: async (loanId: string) => {
      const loan = loans.find((l) => l.id === loanId);
      if (!loan) throw new Error("Loan not found");
      const chain = loan.borrow_chain as ChainKind;
      const setting = settings.find((s) => s.chain === chain);
      if (!setting?.disburser_address) throw new Error(`Set the Disburser contract address for ${CHAINS[chain].name} first`);
      const asset = CHAINS[chain].assets.find((a) => a.symbol === loan.borrow_asset);
      if (!asset) throw new Error(`Asset ${loan.borrow_asset} not supported on ${chain}`);

      // Convert USD → token amount using a live-ish price. For USD-pegged assets that's ~1:1.
      // For native assets we need a price fetch — do it here to keep the tx honest.
      let tokenAmount = Number(loan.requested_amount_usd);
      if (!["USDC", "USDT", "BUSD", "DAI"].includes(asset.symbol)) {
        const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${asset.coingeckoId}&vs_currencies=usd`);
        const priceJson = await priceRes.json();
        const price = priceJson[asset.coingeckoId]?.usd;
        if (!price) throw new Error("Could not fetch token price");
        tokenAmount = tokenAmount / price;
      }
      const amountStr = tokenAmount.toFixed(asset.decimals);

      toast.info("Confirm the Disburser call in your wallet…");
      const txHash = asset.tokenAddress
        ? await disburseErc20(chain, setting.disburser_address, asset.tokenAddress, loan.destination_address, amountStr, asset.decimals, loanId)
        : await disburseNative(chain, setting.disburser_address, loan.destination_address, amountStr, loanId);

      const { error } = await supabase.from("loans").update({
        status: "disbursed",
        disbursed_at: new Date().toISOString(),
        disbursement_tx_hash: txHash,
      }).eq("id", loanId);
      if (error) throw error;
      return { txHash, chain };
    },
    onSuccess: ({ txHash, chain }) => {
      toast.success("Disbursement broadcast on-chain");
      qc.invalidateQueries({ queryKey: ["admin-loans"] });
      qc.invalidateQueries({ queryKey: ["loans"] });
      const url = CHAINS[chain].explorerTx?.(txHash);
      if (url) window.setTimeout(() => window.open(url, "_blank"), 400);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Disbursement failed";
      toast.error(msg, { duration: 15000, description: "Check the signer wallet balance, contract owner, and network before retrying." });
    },
  });

  const saveSetting = useMutation({
    mutationFn: async (row: { chain: ChainKind; treasury_address: string; disburser_address: string; rpc_url: string }) => {
      const { error } = await supabase
        .from("chain_settings")
        .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "chain" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chain settings saved");
      qc.invalidateQueries({ queryKey: ["admin-chain-settings"] });
      qc.invalidateQueries({ queryKey: ["chain-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const [notesByLoan, setNotesByLoan] = useState<Record<string, string>>({});

  const pending = loans.filter((l) => l.status === "pending");
  const approved = loans.filter((l) => l.status === "approved");
  const other = loans.filter((l) => l.status !== "pending" && l.status !== "approved");

  const stats = [
    { label: "Users", value: profiles.length.toString() },
    { label: "Deposits received", value: fmt(deposits.reduce((s, d) => s + Number(d.usd_value_at_deposit), 0)) },
    { label: "Pending loans", value: pending.length.toString() },
    { label: "Disbursed", value: fmt(loans.filter((l) => l.status === "disbursed").reduce((s, l) => s + Number(l.requested_amount_usd), 0)) },
  ];

  return (
    <AppShell title="Admin console">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs text-accent">
        <ShieldCheck size={12} /> Admin access
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/60 bg-gradient-surface p-5 shadow-elegant">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</div>
            <div className="mt-2 font-display text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Chain settings */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Chain settings</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Paste your treasury wallet (where user deposits arrive) and the deployed Disburser contract address for each chain.
          See <code className="rounded bg-white/5 px-1">contracts/README.md</code> for deploy instructions.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {ALL_CHAINS.map((c) => {
            const enabled = ENABLED_CHAINS.some((chain) => chain.id === c.id);
            const current = settings.find((s) => s.chain === c.id);
            return <ChainSettingCard key={c.id} chain={c.id} enabled={enabled} current={current} onSave={saveSetting.mutate} saving={saveSetting.isPending} />;
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Pending review · {pending.length}</h2>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-gradient-surface p-6 text-sm text-muted-foreground">No pending loans.</div>
        ) : (
          <div className="space-y-3">
            {pending.map((l) => {
              const dep = deposits.find((d) => d.id === l.collateral_deposit_id);
              const prof = profiles.find((p) => p.id === l.user_id);
              return (
                <div key={l.id} className="rounded-2xl border border-warning/30 bg-gradient-surface p-5 shadow-elegant">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Borrower</div>
                      <div className="mt-1 font-medium">{prof?.display_name ?? "user"}</div>
                      <div className="text-xs text-muted-foreground">{prof?.email}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Loan</div>
                      <div className="mt-1 font-medium">${Number(l.requested_amount_usd).toLocaleString()} in {l.borrow_asset}</div>
                      <div className="text-xs text-muted-foreground">
                        on {CHAINS[l.borrow_chain as ChainKind].name} · {Number(l.leverage_multiplier)}× · {l.term_months}mo
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">→ {shortAddress(l.destination_address)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Deposit received</div>
                      {dep && (
                        <>
                          <div className="mt-1 font-medium">{dep.amount} {dep.asset} · ${Number(dep.usd_value_at_deposit).toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">on {CHAINS[dep.chain as ChainKind].name}</div>
                          {dep.deposit_tx_hash && CHAINS[dep.chain as ChainKind].explorerTx && (
                            <a href={CHAINS[dep.chain as ChainKind].explorerTx!(dep.deposit_tx_hash)} target="_blank" rel="noreferrer"
                               className="mt-1 inline-block font-mono text-xs text-primary hover:underline">
                              tx {shortAddress(dep.deposit_tx_hash)} ↗
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      placeholder="Optional notes"
                      value={notesByLoan[l.id] ?? ""}
                      onChange={(e) => setNotesByLoan((n) => ({ ...n, [l.id]: e.target.value }))}
                      className="flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-ring"
                    />
                    <button
                      onClick={() => decide.mutate({ id: l.id, status: "rejected", notes: notesByLoan[l.id] })}
                      disabled={decide.isPending}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
                    ><X size={14} /> Reject</button>
                    <button
                      onClick={() => decide.mutate({ id: l.id, status: "approved", notes: notesByLoan[l.id] })}
                      disabled={decide.isPending}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-95"
                    ><Check size={14} /> Approve</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Approved · awaiting on-chain disbursement · {approved.length}</h2>
        {approved.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-gradient-surface p-6 text-sm text-muted-foreground">Nothing to disburse.</div>
        ) : (
          <div className="space-y-3">
            {approved.map((l) => (
              <div key={l.id} className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-gradient-surface p-5 shadow-elegant sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">${Number(l.requested_amount_usd).toLocaleString()} · {l.borrow_asset} on {CHAINS[l.borrow_chain as ChainKind].name}</div>
                  <div className="font-mono text-xs text-muted-foreground">→ {l.destination_address}</div>
                </div>
                <button
                  onClick={() => disburse.mutate(l.id)}
                  disabled={disburse.isPending}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-95 disabled:opacity-60"
                >
                  {disburse.isPending && disburse.variables === l.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Disburse via Disburser contract
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 mb-16">
        <h2 className="mb-3 font-display text-lg font-semibold">History · {other.length}</h2>
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-gradient-surface shadow-elegant">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Chain</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {other.map((l) => {
                const meta = CHAINS[l.borrow_chain as ChainKind];
                return (
                  <tr key={l.id}>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">${Number(l.requested_amount_usd).toLocaleString()} {l.borrow_asset}</td>
                    <td className="px-4 py-3">{meta.name}</td>
                    <td className="px-4 py-3 capitalize">{l.status}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {l.disbursement_tx_hash && meta.explorerTx ? (
                        <a href={meta.explorerTx(l.disbursement_tx_hash)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {shortAddress(l.disbursement_tx_hash)} ↗
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ManualLoanCard profiles={profiles} onCreated={() => qc.invalidateQueries({ queryKey: ["admin-loans"] })} />
    </AppShell>
  );
}

function ManualLoanCard({ profiles, onCreated }: { profiles: Array<{ id: string; email: string | null; display_name: string | null }>; onCreated: () => void }) {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("USDT");
  const [chain, setChain] = useState<ChainKind>("ethereum");
  const [destination, setDestination] = useState("");
  const [term, setTerm] = useState("12");

  const create = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!userId) throw new Error("Pick a user");
      if (!amt || amt <= 0) throw new Error("Enter loan amount");
      if (!destination) throw new Error("Enter destination address");
      const dueAt = new Date();
      dueAt.setMonth(dueAt.getMonth() + Number(term || 12));
      const { error } = await supabase.from("loans").insert({
        user_id: userId,
        borrow_asset: asset,
        borrow_chain: chain,
        requested_amount_usd: amt,
        ltv_percent: 0,
        leverage_multiplier: 0,
        term_months: Number(term || 12),
        repayment_due_at: dueAt.toISOString(),
        destination_address: destination,
        status: "approved",
        decided_at: new Date().toISOString(),
        admin_notes: "Manual admin-granted loan",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Loan granted — ready to disburse from the pending list.");
      setAmount(""); setDestination(""); setUserId("");
      onCreated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create loan"),
  });

  return (
    <section className="mt-8 rounded-2xl border border-accent/30 bg-gradient-surface p-6 shadow-elegant">
      <h2 className="mb-1 font-display text-lg font-semibold">Grant a manual loan</h2>
      <p className="mb-5 text-xs text-muted-foreground">
        Give any user a loan directly, with no collateral requirement. It will appear as approved and ready to disburse from your admin wallet.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">User</span>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-ring">
            <option value="">Pick a user…</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.email || p.id}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">Amount (USD)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" placeholder="10000" className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-ring" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">Chain</span>
          <select value={chain} onChange={(e) => setChain(e.target.value as ChainKind)} className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-ring">
           {ENABLED_CHAINS.map((c) => (
  <option key={c.id} value={c.id}>
    {c.name}
  </option>
))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">Asset</span>
          <select value={asset} onChange={(e) => setAsset(e.target.value)} className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-ring">
            {CHAINS[chain].assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">Destination address</span>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="0x…" className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 font-mono text-xs outline-none focus:border-ring" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">Term (months)</span>
          <input value={term} onChange={(e) => setTerm(e.target.value)} type="number" min="1" className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-ring" />
        </label>
      </div>
      <button
        onClick={() => create.mutate()}
        disabled={create.isPending}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-60"
      >
        {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        Grant loan
      </button>
    </section>
  );
}


type ChainSettingRow = {
  chain: string;
  treasury_address: string | null;
  disburser_address: string | null;
  rpc_url: string | null;
};

function ChainSettingCard({
  chain,
  enabled,
  current,
  onSave,
  saving,
}: {
  chain: ChainKind;
  enabled: boolean;
  current?: ChainSettingRow;
  onSave: (row: { chain: ChainKind; treasury_address: string; disburser_address: string; rpc_url: string }) => void;
  saving: boolean;
}) {
  const meta = CHAINS[chain];
  const [treasury, setTreasury] = useState(current?.treasury_address ?? "");
  const [disburser, setDisburser] = useState(current?.disburser_address ?? "");
  const [rpc, setRpc] = useState(current?.rpc_url ?? "");

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-surface p-5 shadow-elegant">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ background: meta.color }} />
          <div className="font-display font-semibold">{meta.name}</div>
          <span className="text-xs text-muted-foreground">{meta.networkLabel}</span>
        </div>
        {!enabled && <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground">disabled</span>}
      </div>
      <div className="space-y-3">
        <Field label="Treasury address" value={treasury} onChange={setTreasury} placeholder="0x…" disabled={!enabled} />
        <Field label="Disburser contract" value={disburser} onChange={setDisburser} placeholder="0x…" disabled={!enabled} />
        <Field label="RPC URL (optional)" value={rpc} onChange={setRpc} placeholder="https://…" disabled={!enabled} />
        <button
          onClick={() => onSave({ chain, treasury_address: treasury, disburser_address: disburser, rpc_url: rpc })}
          disabled={saving || !enabled}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 font-mono text-xs outline-none focus:border-ring disabled:opacity-50"
      />
    </label>
  );
}

function fmt(n: number) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
