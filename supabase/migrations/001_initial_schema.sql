-- DocDrop initial schema
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/fiorxuddpviuwouyzbdm/sql/new

-- ── Conversion metadata log ───────────────────────────────────────────────────
create table if not exists public.conversions (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid references auth.users(id) on delete set null,
    filename        text not null,
    file_ext        text,
    file_size_bytes bigint,
    ocr_engine      text,          -- null = no OCR, 'tesseract', 'surya'
    ocr_used        boolean not null default false,
    page_count      int,
    char_count      int,
    word_count      int,
    duration_ms     int,
    created_at      timestamptz not null default now()
);

-- ── Credit ledger ─────────────────────────────────────────────────────────────
create table if not exists public.ocr_transactions (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    delta       int not null,      -- positive = credit, negative = debit
    reason      text not null,     -- 'signup_bonus' | 'stripe_purchase' | 'stripe_subscription' | 'ocr_pages'
    metadata    jsonb,             -- stripe session id, page count, etc.
    created_at  timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.conversions enable row level security;
alter table public.ocr_transactions enable row level security;

-- Users can only read their own rows
create policy "users read own conversions"
    on public.conversions for select
    using (auth.uid() = user_id);

create policy "users read own transactions"
    on public.ocr_transactions for select
    using (auth.uid() = user_id);

-- Service role (backend) bypasses RLS — no insert policies needed for users

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists conversions_user_id_idx on public.conversions(user_id);
create index if not exists conversions_created_at_idx on public.conversions(created_at desc);
create index if not exists ocr_transactions_user_id_idx on public.ocr_transactions(user_id);
