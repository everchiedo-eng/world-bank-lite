import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { CHAINS } from "@/lib/chains";
import {
  ArrowRight,
  Coins,
  Wallet,
  TrendingUp,
  ShieldCheck,
  Clock3,
  CircleDollarSign,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — Trump Wallet Loan" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: userId } = useQuery({
    queryKey: ["user-id"],
    queryFn: async () =>
      (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [wallets, deposits, loans] = await Promise.all([
        supabase
          .from("connected_wallets")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("collateral_deposits")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("loans")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      return {
        wallets: wallets.data ?? [],
        deposits: deposits.data ?? [],
        loans: loans.data ?? [],
      };
    },
  });

  const deposits = data?.deposits ?? [];
  const loans = data?.loans ?? [];
  const wallets = data?.wallets ?? [];

  const totalCollateralUsd = deposits
    .filter((d) => d.status === "locked")
    .reduce((sum, d) => sum + Number(d.usd_value_at_deposit), 0);

  const activeLoans = loans.filter((l) => l.status === "disbursed");

  const activeBorrowUsd = activeLoans.reduce(
    (sum, l) => sum + Number(l.requested_amount_usd),
    0,
  );

  const pendingLoans = loans.filter((l) => l.status === "pending");

  const totalLoanCount = loans.length;

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">

        {/* HERO */}
        <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[#07101f] p-6 shadow-2xl md:p-8">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-500/10 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              <img
                src="/logo.png"
                alt="Trump Wallet Loan"
                className="h-20 w-20 rounded-2xl border border-yellow-500/30 object-cover shadow-lg"
              />

              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-yellow-400">
                  Trump Wallet Loan
                </div>

                <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
                  Welcome to your wallet
                </h2>

                <p className="mt-2 max-w-xl text-sm text-slate-400">
                  Manage your collateral, connected wallets and loan
                  positions from one secure dashboard.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/wallets"
                className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm font-semibold text-yellow-300 transition hover:bg-yellow-500/20"
              >
                <Wallet size={16} />
                Wallets
              </Link>

              <Link
                to="/borrow"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-yellow-500/10 transition hover:brightness-110"
              >
                <Coins size={16} />
                Apply for Loan
              </Link>
            </div>
          </div>
        </section>

        {/* STAT CARDS */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatCard
            icon={<CircleDollarSign size={19} />}
            label="Total Collateral"
            value={fmtUsd(totalCollateralUsd)}
            description={`${deposits.length} collateral deposit${deposits.length === 1 ? "" : "s"}`}
          />

          <StatCard
            icon={<TrendingUp size={19} />}
            label="Active Loans"
            value={fmtUsd(activeBorrowUsd)}
            description={`${activeLoans.length} active position${activeLoans.length === 1 ? "" : "s"}`}
          />

          <StatCard
            icon={<Clock3 size={19} />}
            label="Pending Review"
            value={String(pendingLoans.length)}
            description="Awaiting loan approval"
          />

          <StatCard
            icon={<Wallet size={19} />}
            label="Connected Wallets"
            value={String(wallets.length)}
            description="Wallets connected to account"
          />

        </section>

        {/* MAIN GRID */}
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">

          {/* LOAN OVERVIEW */}
          <section className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-elegant">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
                  Overview
                </div>

                <h3 className="mt-1 font-display text-xl font-semibold">
                  Loan activity
                </h3>
              </div>

              <Link
                to="/loans"
                className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400 hover:text-yellow-300"
              >
                View all
                <ChevronRight size={14} />
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4">
              <OverviewItem
                label="Total loans"
                value={String(totalLoanCount)}
              />

              <OverviewItem
                label="Active"
                value={String(activeLoans.length)}
              />

              <OverviewItem
                label="Pending"
                value={String(pendingLoans.length)}
              />
            </div>

            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Loan activity</span>
                <span>{totalLoanCount} total</span>
              </div>

              <div className="flex h-32 items-end gap-2 rounded-xl border border-border/50 bg-black/10 p-4">
                {loans.length === 0 ? (
                  <div className="flex w-full items-center justify-center text-sm text-muted-foreground">
                    No loan activity yet
                  </div>
                ) : (
                  loans
                    .slice(0, 10)
                    .reverse()
                    .map((loan, index) => (
                      <div
                        key={loan.id ?? index}
                        className="flex-1 rounded-t-md bg-gradient-to-t from-yellow-600 to-yellow-300 opacity-90 transition hover:opacity-100"
                        style={{
                          height: `${Math.max(
                            12,
                            Math.min(
                              100,
                              Number(loan.requested_amount_usd) /
                                Math.max(activeBorrowUsd, 1) *
                                100,
                            ),
                          )}%`,
                        }}
                        title={fmtUsd(Number(loan.requested_amount_usd))}
                      />
                    ))
                )}
              </div>
            </div>
          </section>

          {/* QUICK ACTIONS */}
          <section className="rounded-2xl border border-border/60 bg-gradient-surface p-6 shadow-elegant">
            <div className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
              Quick actions
            </div>

            <h3 className="mt-1 font-display text-xl font-semibold">
              Manage your account
            </h3>

            <div className="mt-5 space-y-3">

              <ActionLink
                to="/wallets"
                icon={<Wallet size={18} />}
                title="Connect Wallet"
                description="Manage MetaMask, Phantom and supported wallets"
              />

              <ActionLink
                to="/borrow"
                icon={<Coins size={18} />}
                title="Apply for Loan"
                description="Deposit collateral and request funding"
              />

              <ActionLink
                to="/loans"
                icon={<TrendingUp size={18} />}
                title="View My Loans"
                description="Track pending and active loan positions"
              />

            </div>

            <div className="mt-5 flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 p-3 text-xs text-green-400">
              <ShieldCheck size={16} />
              Your account is connected and protected.
            </div>
          </section>
        </div>

        {/* RECENT COLLATERAL */}
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-surface shadow-elegant">

          <div className="flex items-center justify-between border-b border-border/60 px-5 py-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
                Portfolio
              </div>

              <h3 className="mt-1 font-display text-lg font-semibold">
                Recent collateral
              </h3>
            </div>

            <Link
              to="/borrow"
              className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400 hover:text-yellow-300"
            >
              Deposit collateral
              <ArrowRight size={13} />
            </Link>
          </div>

          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Loading your portfolio...
            </div>
          ) : deposits.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-400">
                <Wallet size={22} />
              </div>

              <div className="font-medium">
                No collateral deposited yet
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Deposit collateral to become eligible for a loan.
              </p>

              <Link
                to="/borrow"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-yellow-400"
              >
                Deposit collateral
                <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {deposits.slice(0, 5).map((deposit) => (
                <div
                  key={deposit.id}
                  className="flex flex-col gap-3 px-5 py-4 transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full"
                      style={{
                        background: CHAINS[deposit.chain].color,
                      }}
                    />

                    <div>
                      <div className="font-medium">
                        {deposit.amount} {deposit.asset}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {CHAINS[deposit.chain].name} ·{" "}
                        {new Date(
                          deposit.created_at,
                        ).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-8 sm:justify-end">
                    <div className="text-right">
                      <div className="font-medium">
                        {fmtUsd(
                          Number(deposit.usd_value_at_deposit),
                        )}
                      </div>

                      <div
                        className={`text-xs ${
                          deposit.status === "locked"
                            ? "text-green-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {deposit.status}
                      </div>
                    </div>

                    <ChevronRight
                      size={16}
                      className="text-muted-foreground"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECURITY NOTICE */}
        <section className="flex flex-col gap-4 rounded-2xl border border-yellow-500/15 bg-yellow-500/[0.03] p-5 sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-400">
            <ShieldCheck size={21} />
          </div>

          <div className="flex-1">
            <div className="font-medium">
              Trump Wallet Loan Security
            </div>

            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Always verify the wallet address and network before
              approving a transaction. Never share your private key or
              recovery phrase.
            </p>
          </div>
        </section>

      </div>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="group rounded-2xl border border-border/60 bg-gradient-surface p-5 shadow-elegant transition hover:border-yellow-500/30">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400">
          {icon}
        </div>
      </div>

      <div className="mt-4 font-display text-2xl font-bold">
        {value}
      </div>

      <div className="mt-1 text-xs text-muted-foreground">
        {description}
      </div>
    </div>
  );
}

function OverviewItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-black/10 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl font-bold">
        {value}
      </div>
    </div>
  );
}

function ActionLink({
  to,
  icon,
  title,
  description,
}: {
  to: "/wallets" | "/borrow" | "/loans";
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-border/50 bg-black/10 p-3 transition hover:border-yellow-500/30 hover:bg-yellow-500/[0.03]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-400">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {description}
        </div>
      </div>

      <ArrowRight
        size={15}
        className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-yellow-400"
      />
    </Link>
  );
}

function fmtUsd(n: number) {
  return "$" + n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

