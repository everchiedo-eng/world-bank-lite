import { AlertTriangle, ArrowRight, X } from "lucide-react";

export type TxPreview = {
  chainName: string;
  networkLabel: string;
  action: string; // e.g. "Transfer" / "Approve"
  assetSymbol: string;
  assetStandard?: string;
  amount: string; // human amount, e.g. "1.25"
  usdValue?: number;
  fromAddress: string;
  toAddress: string;
  toLabel?: string; // e.g. "Admin treasury"
  methodLabel: string; // e.g. "ERC-20 transfer(address,uint256)" or "Native ETH transfer"
  calldataHex?: string; // raw calldata if any
  warnings?: string[];
};

function short(a: string): string {
  if (!a) return "";
  return a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;
}

export function TxConfirmModal({
  open,
  preview,
  onCancel,
  onConfirm,
  confirmLabel = "Approve & sign in wallet",
  busy = false,
}: {
  open: boolean;
  preview: TxPreview | null;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  busy?: boolean;
}) {
  if (!open || !preview) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-confirm-title"
        className="w-full max-w-lg overflow-hidden rounded-t-2xl border border-border/60 bg-background shadow-2xl sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-warning" />
            <h2 id="tx-confirm-title" className="font-display text-base font-semibold">
              Review before signing
            </h2>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            aria-label="Cancel"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-white/5 hover:text-foreground disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 border-b border-warning/20 bg-warning/5 px-5 py-3 text-xs text-warning">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            Your wallet will now ask you to sign this exact transaction. It moves real funds and is
            <span className="font-semibold"> irreversible</span> once broadcast. Verify every field below.
          </div>
        </div>

        {/* Summary card */}
        <div className="space-y-3 px-5 py-4">
          <div className="rounded-xl border border-border/60 bg-background/40 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Action</div>
            <div className="mt-0.5 flex items-center justify-between">
              <div className="font-display text-lg font-semibold">{preview.action}</div>
              <div className="text-xs text-muted-foreground">
                {preview.chainName} · {preview.networkLabel}
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <div className="font-mono text-2xl font-semibold text-foreground">
                  {preview.amount} {preview.assetSymbol}
                </div>
                {typeof preview.usdValue === "number" && (
                  <div className="text-xs text-muted-foreground">
                    ≈ ${preview.usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              {preview.assetStandard && (
                <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {preview.assetStandard}
                </span>
              )}
            </div>
          </div>

          {/* From / To */}
          <div className="rounded-xl border border-border/60 bg-background/40 p-4">
            <Field label="From (your wallet)" value={preview.fromAddress} />
            <div className="my-3 flex items-center gap-2 text-muted-foreground">
              <ArrowRight size={14} />
              <span className="text-[10px] uppercase tracking-widest">funds move to</span>
            </div>
            <Field
              label={preview.toLabel ? `To · ${preview.toLabel}` : "To"}
              value={preview.toAddress}
              emphasized
            />
          </div>

          {/* Method + calldata */}
          <details className="rounded-xl border border-border/60 bg-background/40 p-4 text-xs">
            <summary className="cursor-pointer select-none text-muted-foreground">
              Technical details ·{" "}
              <span className="font-mono text-foreground">{preview.methodLabel}</span>
            </summary>
            {preview.calldataHex && (
              <div className="mt-3">
                <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Calldata
                </div>
                <code className="block max-h-32 overflow-auto break-all rounded-md border border-border/60 bg-background/60 p-2 font-mono text-[11px] leading-relaxed text-foreground">
                  {preview.calldataHex}
                </code>
              </div>
            )}
          </details>

          {preview.warnings && preview.warnings.length > 0 && (
            <ul className="space-y-1.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {preview.warnings.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-border/60 bg-background/60 px-5 py-4">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-lg border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-white/5 hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-[1.4] rounded-lg bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant transition hover:opacity-95 disabled:opacity-60"
          >
            {busy ? "Waiting for wallet…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <code
          className={`min-w-0 flex-1 break-all font-mono text-xs ${emphasized ? "text-foreground" : "text-muted-foreground"}`}
        >
          {value}
        </code>
        <span className="shrink-0 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {short(value)}
        </span>
      </div>
    </div>
  );
}
