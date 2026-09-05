import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Chainvault" },
      {
        name: "description",
        content:
          "Sign in or create an account to borrow against your crypto.",
      },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

function AuthPage() {
  const nav = useNavigate();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const timeout = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("Session check timed out")),
            8000
          );
        });

        const sessionRequest = supabase.auth.getSession();

        const { data } = await Promise.race([
          sessionRequest,
          timeout,
        ]);

        if (!cancelled && data.session) {
          nav({ to: "/dashboard", replace: true });
        }
      } catch (err) {
        console.error("Session check failed:", err);
      }
    };

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = schema.safeParse({
      email,
      password,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    if (busy) return;

    setBusy(true);

    try {
      const request =
        mode === "signup"
          ? supabase.auth.signUp({
              email: parsed.data.email,
              password: parsed.data.password,
              options: {
                emailRedirectTo:
                  `${window.location.origin}/dashboard`,
              },
            })
          : supabase.auth.signInWithPassword({
              email: parsed.data.email,
              password: parsed.data.password,
            });

      const timeout = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                "Request timed out. Check your internet connection and try again."
              )
            ),
          15000
        );
      });

      const { error } = await Promise.race([
        request,
        timeout,
      ]);

      if (error) {
        throw error;
      }

      if (mode === "signup") {
        toast.success("Account created");
      } else {
        toast.success("Signed in successfully");
      }

      nav({
        to: "/dashboard",
        replace: true,
      });
    } catch (err) {
      console.error("Authentication failed:", err);

      toast.error(
        err instanceof Error
          ? err.message
          : "Unable to complete authentication"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-8 flex items-center justify-center gap-2"
        >
          <div className="h-9 w-9 rounded-lg bg-gradient-primary shadow-glow" />

          <span className="font-display text-xl font-semibold">
            Chainvault
          </span>
        </Link>

        <div className="rounded-2xl border border-border/60 bg-gradient-surface p-8 shadow-elegant">
          <div className="mb-6 flex rounded-lg border border-border/60 p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={busy}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${busy ? "cursor-not-allowed opacity-60" : ""}`}
              >
                {m === "signin"
                  ? "Sign in"
                  : "Create account"}
              </button>
            ))}
          </div>

          <form
            onSubmit={submit}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Email
              </label>

              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-input bg-background/60 px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Password
              </label>

              <div className="relative">
                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete={
                    mode === "signin"
                      ? "current-password"
                      : "new-password"
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  disabled={busy}
                  className="w-full rounded-lg border border-input bg-background/60 px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
                  placeholder="At least 8 characters"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((v) => !v)
                  }
                  disabled={busy}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              )}

              {mode === "signin"
                ? busy
                  ? "Signing in..."
                  : "Sign in"
                : busy
                ? "Creating account..."
                : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            The first user to sign up is granted admin
            access automatically.
          </p>
        </div>
      </div>
    </div>
  );
}