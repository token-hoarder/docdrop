-- Fix sync_credit_balance trigger
-- The INSERT ... ON CONFLICT pattern evaluates CHECK against the INSERT values
-- before resolving the conflict, causing false check constraint violations on debits.
-- Rewrite to UPDATE first, INSERT only for genuinely new users.
-- Run in: https://supabase.com/dashboard/project/fiorxuddpviuwouyzbdm/sql/new

CREATE OR REPLACE FUNCTION public.sync_credit_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    UPDATE public.credit_balances
    SET balance    = balance + NEW.delta,
        updated_at = now()
    WHERE user_id = NEW.user_id;

    -- Only INSERT for brand-new users (their very first transaction)
    IF NOT FOUND THEN
        INSERT INTO public.credit_balances (user_id, balance, updated_at)
        VALUES (NEW.user_id, NEW.delta, now());
    END IF;

    RETURN NEW;
END;
$$;
