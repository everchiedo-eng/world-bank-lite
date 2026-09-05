import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Layers, Lock, ShieldCheck } from "lucide-react";
import { CHAIN_LIST } from "@/lib/chains";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trump Wallet Loan" },
      {
        name: "description",
        content: "Trump Wallet Loan - crypto wallet and lending platform.",
      },
      {
        property: "og:title",
        content: "Trump Wallet Loan",
      },
      {
        property: "og:description",
        content: "Manage your crypto and access wallet-based lending.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Trump Wallet Loan"
            className="h-10 w-10 rounded-lg object-cover"
          />
          <span className="font-display text-lg font-semibold tracking-tight">
            Trump Wallet Loan
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Sign in
          </Link>

          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant transition hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-24 text-center">
        <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          Borrow against your crypto.
          <span className="block bg-gradient-primary bg-clip-text text-transparent">
            Across major blockchain networks.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
          Secure your digital assets, manage your connected wallets, and
          request crypto-backed loans from one simple platform.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/auth"
            className="group inline-flex items-center gap-2 rounded-lg bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant hover:opacity-95"
          >
            Open an account
            <ArrowRight
              size={16}
              className="transition group-hover:translate-x-0.5"
            />
          </Link>

          <a
            href="#chains"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium hover:bg-white/5"
          >
            View supported chains
          </a>
        </div>

        {/* Feature cards */}
        <div className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-3">
          {[
            {
              icon: Layers,
              title: "Multi-chain",
              body: "Connect and manage assets across supported blockchain networks.",
            },
            {
              icon: Lock,
              title: "Asset secured",
              body: "Keep your crypto assets securely connected while managing your positions.",
            },
            {
              icon: ShieldCheck,
              title: "Secure platform",
              body: "A clean and simple interface for managing wallets and loan activity.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border/60 bg-gradient-surface p-6 text-left shadow-elegant"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon size={20} />
              </div>

              <h3 className="mb-1 font-display text-base font-semibold">
                {title}
              </h3>

              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Supported chains */}
      <section id="chains" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-border/60 bg-gradient-surface p-8 shadow-elegant md:p-12">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Supported networks
            </div>

            <h2 className="mt-1 font-display text-2xl font-semibold md:text-3xl">
              Manage your crypto across chains
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CHAIN_LIST.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-border/60 bg-background/40 p-5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-full"
                    style={{ background: c.color }}
                  />

                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.assets.length} assets
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.assets.map((a) => (
                    <span
                      key={a.symbol}
                      className="rounded-md border border-border/60 bg-white/5 px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {a.symbol}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        Trump Wallet Loan
      </footer>
    </div>
  );
}
