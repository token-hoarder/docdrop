-- DocDrop: atomic credit debit via credit_balances table
-- Run in: https://supabase.com/dashboard/project/fiorxuddpviuwouyzbdm/sql/new

-- ── credit_balances — one row per user, always current ────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_balances (
    user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance    int  NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT balance_non_negative CHECK (balance >= 0)
);

ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own balance"
    ON public.credit_balances FOR SELECT
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS credit_balances_user_id_idx ON public.credit_balances(user_id);

-- ── Trigger: sync credit_balances on every ocr_transactions INSERT ────────────
-- This is the single source of truth for balance updates.
-- All credit grants (signup, Stripe) and debits flow through here automatically.
CREATE OR REPLACE FUNCTION public.sync_credit_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.credit_balances (user_id, balance, updated_at)
    VALUES (NEW.user_id, NEW.delta, now())
    ON CONFLICT (user_id) DO UPDATE
        SET balance    = credit_balances.balance + NEW.delta,
            updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER ocr_transactions_sync_balance
    AFTER INSERT ON public.ocr_transactions
    FOR EACH ROW EXECUTE PROCEDURE public.sync_credit_balance();

-- ── Backfill from existing ledger ─────────────────────────────────────────────
INSERT INTO public.credit_balances (user_id, balance)
SELECT user_id, COALESCE(SUM(delta), 0)
FROM public.ocr_transactions
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE
    SET balance = EXCLUDED.balance;

-- ── debit_credits — atomic debit with row-level lock ─────────────────────────
-- Uses SELECT ... FOR UPDATE to serialize concurrent debits for the same user.
-- The CHECK constraint on credit_balances is the final safety net.
CREATE OR REPLACE FUNCTION public.debit_credits(
    p_user_id  uuid,
    p_pages    int,
    p_metadata jsonb DEFAULT '{}'
)
RETURNS int  -- new balance after debit
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_balance int;
BEGIN
    SELECT balance INTO v_balance
    FROM public.credit_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_balance IS NULL OR v_balance < p_pages THEN
        RAISE EXCEPTION 'insufficient_credits: need %, have %',
            p_pages, COALESCE(v_balance, 0)
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.ocr_transactions (user_id, delta, reason, metadata)
    VALUES (p_user_id, -p_pages, 'ocr_pages', p_metadata);
    -- ↑ trigger fires here and decrements credit_balances atomically

    RETURN v_balance - p_pages;
END;
$$;

-- ── get_credit_balance — O(1) read from balance row ──────────────────────────
-- Previously did SUM(delta) over the full ledger; now a single row read.
CREATE OR REPLACE FUNCTION public.get_credit_balance(p_user_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
    SELECT COALESCE(balance, 0)
    FROM public.credit_balances
    WHERE user_id = p_user_id;
$$;
