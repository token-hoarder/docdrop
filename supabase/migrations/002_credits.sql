-- DocDrop credits — signup bonus trigger + balance helper
-- Run in: https://supabase.com/dashboard/project/fiorxuddpviuwouyzbdm/sql/new

-- ── Signup bonus trigger ──────────────────────────────────────────────────────
-- Fires after every new auth.users row — grants 10 free OCR credits
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.ocr_transactions (user_id, delta, reason)
    values (new.id, 10, 'signup_bonus');
    return new;
end;
$$;

create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- ── Credit balance function ───────────────────────────────────────────────────
-- Returns current balance for a user (sum of all deltas)
create or replace function public.get_credit_balance(p_user_id uuid)
returns int
language sql
stable
security definer set search_path = public
as $$
    select coalesce(sum(delta), 0)::int
    from public.ocr_transactions
    where user_id = p_user_id;
$$;
