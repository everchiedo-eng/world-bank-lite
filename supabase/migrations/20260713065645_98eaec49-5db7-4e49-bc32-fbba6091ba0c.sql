
-- Chain-level admin settings: treasury (where deposits go) and Disburser contract address.
CREATE TABLE public.chain_settings (
  chain chain_kind PRIMARY KEY,
  treasury_address text,
  disburser_address text,
  rpc_url text,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chain_settings TO authenticated;
GRANT ALL ON public.chain_settings TO service_role;
ALTER TABLE public.chain_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in reads chain settings" ON public.chain_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins write chain settings" ON public.chain_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed rows for the two testnets the user picked (admin fills in addresses via UI).
INSERT INTO public.chain_settings (chain, enabled) VALUES ('ethereum', true), ('bnb', true), ('polygon', false), ('solana', false)
ON CONFLICT (chain) DO NOTHING;

-- Track the on-chain deposit tx hash for each collateral deposit.
ALTER TABLE public.collateral_deposits ADD COLUMN IF NOT EXISTS deposit_tx_hash text;
ALTER TABLE public.collateral_deposits ADD COLUMN IF NOT EXISTS to_address text;

-- Loan mechanics: leverage tiers instead of LTV cap; add term + repayment due date.
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS leverage_multiplier numeric NOT NULL DEFAULT 10;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS term_months integer NOT NULL DEFAULT 12;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS repayment_due_at timestamptz;
