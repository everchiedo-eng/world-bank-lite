import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { CHAIN_LIST, CHAINS, type ChainKind } from "@/lib/chains";
import { connectWithMethod, shortAddress, type WalletMethod } from "@/lib/wallet-connect";
import { WalletPickerModal } from "@/components/wallet-picker-modal";
import { toast } from "sonner";
import { Loader2, Plug, Copy, Check, X } from "lucide-react";
import { useState } from "react";


export const Route = createFileRoute("/_authenticated/wallets")({
  head: () => ({ meta: [{ title: "Wallets — Chainvault" }] }),
  component: Wallets,
});

function Wallets() {
  const qc = useQueryClient();

  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("connected_wallets").select("*").order("chain");
      if (error) throw error;
      return data;
    },
  });

  const [picker, setPicker] = useState<ChainKind | null>(null);

  const connect = useMutation({
    mutationFn: async ({ chain, method }: { chain: ChainKind; method: WalletMethod }) => {
      const { address } = await connectWithMethod(chain, method);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("connected_wallets")
        .upsert({ user_id: user.id, chain, address }, { onConflict: "user_id,chain" });
      if (error) throw error;
      return { chain, address };
    },
    onSuccess: (r) => {
      toast.success(`${CHAINS[r.chain].name} wallet linked`);
      setPicker(null);
      qc.invalidateQueries({ queryKey: ["wallets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to connect", {
      action: { label: "Get help", onClick: () => { window.location.href = "/wallet-help"; } },
    }),
  });


  const disconnect = useMutation({
    mutationFn: async (chain: ChainKind) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("connected_wallets")
        .delete()
        .eq("user_id", user.id)
        .eq("chain", chain);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallets"] }),
  });

  const byChain = new Map(wallets.map((w) => [w.chain as ChainKind, w] as const));

  return (
    <AppShell title="Wallets">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Link one wallet per chain. EVM chains (Ethereum, Polygon, BNB) use MetaMask or any injected wallet.
          Solana uses Phantom. Chainvault only reads your public address — no signatures move funds.
        </p>
        <Link
          to="/wallet-help"
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          Having trouble? Get help →
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CHAIN_LIST.map((c) => {
          const w = byChain.get(c.id);
          return (
            <div key={c.id} className="rounded-2xl border border-border/60 bg-gradient-surface p-5 shadow-elegant">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full" style={{ background: c.color }} />
                  <div>
                    <div className="font-display font-semibold">{c.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {c.assets.map((a) => (
                        <span key={a.symbol} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          <img src={a.logoUrl} alt="" className="h-3 w-3 rounded-full" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                          {a.symbol}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {w ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs text-success">
                    <Check size={12} /> Linked
                  </span>
                ) : (
                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs text-muted-foreground">Not linked</span>
                )}
              </div>

              {w ? (
                <div className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                  <code className="font-mono text-xs">{shortAddress(w.address)}</code>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { navigator.clipboard.writeText(w.address); toast.success("Copied"); }}
                      className="rounded p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => disconnect.mutate(c.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setPicker(c.id)}
                  disabled={connect.isPending}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:opacity-60"
                >
                  {connect.isPending && connect.variables?.chain === c.id ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                  Connect {c.id === "solana" ? "Phantom" : "wallet"}
                </button>
              )}

            </div>
          );
        })}
      </div>

      <NoWalletHint />

      <WalletPickerModal
        open={!!picker}
        chain={picker ?? "ethereum"}
        busy={connect.isPending}
        onCancel={() => setPicker(null)}
        onPick={(method) => picker && connect.mutate({ chain: picker, method })}
      />
    </AppShell>
  );
}


function NoWalletHint() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="mt-6 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm text-muted-foreground">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-medium text-accent">Don't have a wallet?</span>{" "}
          Install <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="text-primary underline">MetaMask</a> for EVM chains
          or <a href="https://phantom.app/download" target="_blank" rel="noreferrer" className="text-primary underline">Phantom</a> for Solana, then refresh.
        </div>
        <button onClick={() => setDismissed(true)} className="rounded p-1 hover:bg-white/5"><X size={14} /></button>
      </div>
    </div>
  );
}
