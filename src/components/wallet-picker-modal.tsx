import { useState } from "react";
import {
  Loader2,
  X,
  Smartphone,
  QrCode,
  Wallet as WalletIcon,
  ExternalLink,
} from "lucide-react";
import type { ChainKind } from "@/lib/chains";
import type { WalletMethod } from "@/lib/wallet-connect";
import { CHAINS } from "@/lib/chains";
import { Link } from "@tanstack/react-router";

type Option = {
  id: WalletMethod;
  label: string;
  sub: string;
  icon: string;
};

const EVM_OPTIONS: Option[] = [
  {
    id: "walletconnect",
    label: "Connect Wallet",
    sub: "Scan the QR code with your preferred mobile wallet",
    icon: "",
  },
];

export function WalletPickerModal({
  open,
  chain,
  busy,
  onCancel,
  onPick,
}: {
  open: boolean;
  chain: ChainKind;
  busy: boolean;
  onCancel: () => void;
  onPick: (method: WalletMethod) => void;
}) {
  const [chosen, setChosen] = useState<WalletMethod | null>(null);

  if (!open) return null;

  const meta = CHAINS[chain];

  const options: Option[] =
    chain === "solana"
      ? [
          {
            id: "phantom",
            label: "Phantom",
            sub: "Connect your Solana wallet",
            icon: "https://phantom.app/img/phantom-logo.svg",
          },
        ]
      : EVM_OPTIONS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-border/60 bg-background p-6 shadow-elegant sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">
              Connect a wallet
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              {meta.name}
            </p>
          </div>

          {!busy && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="space-y-2">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={busy}
              onClick={() => {
                setChosen(o.id);
                onPick(o.id);
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3 text-left transition hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5">
                {o.icon ? (
                  <img
                    src={o.icon}
                    alt=""
                    className="h-7 w-7"
                    onError={(e) => {
                      (
                        e.currentTarget as HTMLImageElement
                      ).style.display = "none";
                    }}
                  />
                ) : o.id === "walletconnect" ? (
                  <QrCode size={20} className="text-primary" />
                ) : (
                  <WalletIcon size={20} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {o.label}

                  {o.id === "walletconnect" && (
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-normal text-primary">
                      QR
                    </span>
                  )}
                </div>

                <div className="mt-0.5 text-xs text-muted-foreground">
                  {o.sub}
                </div>
              </div>

              {busy && chosen === o.id ? (
                <Loader2
                  size={16}
                  className="animate-spin text-muted-foreground"
                />
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <Smartphone
            size={14}
            className="mt-0.5 shrink-0 text-muted-foreground"
          />

          <div>
            Scan the QR code with your wallet app to connect.

            <div className="mt-1">
              Still stuck?{" "}
              <Link
                to="/wallet-help"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                Get help
                <ExternalLink size={10} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}