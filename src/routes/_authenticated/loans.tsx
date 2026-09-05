import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { CHAINS, type ChainKind } from "@/lib/chains";
import { shortAddress } from "@/lib/wallet-connect";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({ meta: [{ title: "My Loans — Chainvault" }] }),
  component: Loans,
});

const STATUS_STYLES: Record<string, string> = {
  pending: "border-warning/40 bg-warning/10 text-warning",
  approved: "border-primary/40 bg-primary/10 text-primary",
  rejected: "border-destructive/40 bg-destructive/10 text-destructive",
  disbursed: "border-success/40 bg-success/10 text-success",
  repaid: "border-border bg-white/5 text-muted-foreground",
};

function Loans() {
  const { data: loans = [] } = useQuery({
    queryKey: ["loans"],
    queryFn: async () => (await supabase.from("loans").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <AppShell title="My loans">
      {loans.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-gradient-surface p-10 text-center shadow-elegant">
          <div className="text-sm text-muted-foreground">
            You haven't requested any loans yet.{" "}
            <Link to="/borrow" className="text-primary hover:underline">Start borrowing →</Link>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-surface shadow-elegant">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Requested</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Chain / Asset</th>
                <th className="px-4 py-3 text-left font-medium">LTV</th>
                <th className="px-4 py-3 text-left font-medium">Destination</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loans.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium">${Number(l.requested_amount_usd).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHAINS[l.borrow_chain as ChainKind].color }} />
                      {CHAINS[l.borrow_chain as ChainKind].name} · {l.borrow_asset}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{Number(l.ltv_percent).toFixed(1)}%</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{shortAddress(l.destination_address)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[l.status] ?? ""}`}>
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
