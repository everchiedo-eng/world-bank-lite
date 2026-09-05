import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { openWalletConnectQr, resetWalletConnect, shortAddress } from "@/lib/wallet-connect";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, QrCode, RefreshCw, Smartphone, Monitor, Chrome, Wallet, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet-help")({
  head: () => ({ meta: [{ title: "Wallet connection help — Chainvault" }] }),
  component: WalletHelp,
});

function WalletHelp() {
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState<string | null>(null);

  async function retryPairing() {
    setBusy(true);
    setConnected(null);
    try {
      await resetWalletConnect();
      const { address } = await openWalletConnectQr("ethereum");
      setConnected(address);
      toast.success("Paired successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pairing failed");
    } finally {
      setBusy(false);
    }
  }

  async function resetOnly() {
    setBusy(true);
    try {
      await resetWalletConnect();
      toast.success("WalletConnect session cleared");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Wallet connection help">
      <div className="mx-auto max-w-3xl space-y-6">
        <p className="text-sm text-muted-foreground">
          Trouble linking your wallet? Follow the steps for your setup below. Most Chrome + mobile
          wallet issues are fixed by clearing the old WalletConnect session and re-scanning the QR.
        </p>

        {/* Retry card */}
        <section className="rounded-2xl border border-primary/30 bg-gradient-surface p-6 shadow-elegant">
          <div className="flex items-center gap-2 font-display text-lg font-semibold">
            <QrCode size={18} className="text-primary" /> Retry WalletConnect pairing
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Clears any stale session, reopens the QR modal, and pairs fresh. Scan the QR with your
            phone wallet's built-in scanner.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={retryPairing}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
              Open QR & retry
            </button>
            <button
              onClick={resetOnly}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-60"
            >
              <RefreshCw size={14} /> Reset session only
            </button>
          </div>
          {connected && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 size={16} /> Paired: <code className="font-mono">{shortAddress(connected)}</code>
              <Link to="/wallets" className="ml-auto text-xs underline">Go to Wallets →</Link>
            </div>
          )}
        </section>

        {/* Chrome desktop + mobile wallet */}
        <Section
          icon={<Chrome size={16} className="text-primary" />}
          title="Chrome on desktop + wallet on your phone"
          badge="Most common"
        >
          <Step n={1}>Open this page in Chrome on your computer.</Step>
          <Step n={2}>On <b>Wallets</b>, tap <b>Connect wallet</b> for the chain you want. A WalletConnect QR code will appear.</Step>
          <Step n={3}>
            On your phone, open your wallet app (MetaMask, Trust, Rainbow, etc.) and use its
            built-in <b>scanner / WalletConnect</b> option — <i>not</i> your camera app.
          </Step>
          <Step n={4}>Approve the connection request on your phone. The QR modal closes and your address appears on this site.</Step>
          <Callout kind="warn">
            If the QR disappears or nothing happens after scanning, tap <b>Open QR & retry</b> above
            to clear the stuck session.
          </Callout>
        </Section>

        {/* Chrome desktop + extension */}
        <Section
          icon={<Monitor size={16} className="text-primary" />}
          title="Chrome on desktop + MetaMask / Rabby / Coinbase extension"
        >
          <Step n={1}>Install the extension and unlock it before hitting Connect.</Step>
          <Step n={2}>If you have multiple extensions, pin only the one you want to use — some conflict with each other.</Step>
          <Step n={3}>Refresh this page after installing so the site can detect the injected wallet.</Step>
        </Section>

        {/* Mobile browser */}
        <Section
          icon={<Smartphone size={16} className="text-primary" />}
          title="On mobile Chrome / Safari"
        >
          <Step n={1}>Tap <b>Connect wallet</b>. If a wallet is installed on your phone, we deep-link into its in-app browser.</Step>
          <Step n={2}>Inside the wallet app, tap the browser tab and reopen this site there — the connection completes automatically.</Step>
          <Step n={3}>Alternative: install <a className="text-primary underline" href="https://metamask.io/download/" target="_blank" rel="noreferrer">MetaMask <ExternalLink size={10} className="inline" /></a> or <a className="text-primary underline" href="https://trustwallet.com/download" target="_blank" rel="noreferrer">Trust <ExternalLink size={10} className="inline" /></a>, then use their in-app browser.</Step>
        </Section>

        {/* Still broken */}
        <Section
          icon={<AlertTriangle size={16} className="text-warning" />}
          title="Still not working?"
        >
          <Step n={1}>Disable ad-blockers / privacy extensions for this site — they often block WalletConnect relays.</Step>
          <Step n={2}>Make sure your phone and computer both have internet (WalletConnect needs both online).</Step>
          <Step n={3}>Update your wallet app to the latest version — old versions don't support WalletConnect v2.</Step>
          <Step n={4}>Tap <b>Reset session only</b> above, close all tabs, reopen, and try again.</Step>
        </Section>

        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-gradient-surface p-4">
          <div className="flex items-center gap-2 text-sm">
            <Wallet size={16} className="text-primary" /> Ready to link your wallet?
          </div>
          <Link to="/wallets" className="rounded-lg bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-95">
            Back to Wallets
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ icon, title, badge, children }: { icon: React.ReactNode; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-elegant">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {badge && <span className="ml-2 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-primary">{badge}</span>}
      </div>
      <ol className="space-y-2 text-sm text-muted-foreground">{children}</ol>
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-[11px] font-semibold text-primary">{n}</span>
      <div className="[&_b]:font-medium [&_b]:text-foreground">{children}</div>
    </li>
  );
}

function Callout({ kind, children }: { kind: "warn"; children: React.ReactNode }) {
  const cls = kind === "warn" ? "border-warning/40 bg-warning/5 text-warning" : "";
  return <div className={`mt-3 rounded-lg border p-3 text-xs ${cls}`}>{children}</div>;
}
