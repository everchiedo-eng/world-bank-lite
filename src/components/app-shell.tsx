import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Wallet,
  Coins,
  Receipt,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      try {
        const timeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Admin check timeout")), 8000);
        });

        const check = (async () => {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) return false;

          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();

          return !!data;
        })();

        return await Promise.race([check, timeout]);
      } catch (error) {
        console.error("Admin check failed:", error);
        return false;
      }
    },
    initialData: false,
    staleTime: 60_000,
    retry: false,
  });
}

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/wallets", label: "Wallets", icon: Wallet },
  { to: "/borrow", label: "Borrow", icon: Coins },
  { to: "/loans", label: "My Loans", icon: Receipt },
] as const;

export function AppShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [router.state.location.pathname]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();

    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Sign-out timeout")), 8000)
        ),
      ]);
    } catch (error) {
      console.error("Sign-out failed:", error);
    }

    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden -ml-1 rounded-md p-2 hover:bg-white/5"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>

            <Link to="/dashboard" className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Trump Wallet Loan"
                className="h-8 w-8 rounded-lg object-cover"
              />
              <span className="font-display text-lg font-semibold tracking-tight">
                Trump Wallet Loan
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Mainnet · Ethereum + BNB Chain
            </span>

            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 lg:px-8">
        <aside
          className={cn(
            "fixed inset-y-16 left-0 z-30 w-64 shrink-0 border-r border-border/60 bg-background/95 p-4 backdrop-blur-xl transition-transform lg:static lg:inset-auto lg:block lg:translate-x-0 lg:border-none lg:bg-transparent lg:p-0",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <nav className="flex flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeProps={{ className: "bg-primary/15 text-foreground" }}
                inactiveProps={{
                  className:
                    "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition"
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}

            {isAdmin && (
              <>
                <div className="mt-4 mb-1 px-3 text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  Admin
                </div>

                <Link
                  to="/admin"
                  activeProps={{ className: "bg-accent/15 text-foreground" }}
                  inactiveProps={{
                    className:
                      "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition"
                >
                  <ShieldCheck size={16} />
                  Admin Console
                </Link>
              </>
            )}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="mb-6 flex items-baseline justify-between">
            <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {title}
            </h1>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}