-- Linked bank accounts (Plaid), for spending tracking and budget insights.
--
-- Everything here is written only by the server (service-role client) from
-- Plaid's API after the user's session is verified, so users get read
-- policies only: letting the browser insert "transactions" would let anyone
-- fabricate bank data. Disconnecting goes through a server action that also
-- revokes the item at Plaid.
--
-- Plaid access tokens are the keys to someone's bank data. They live in
-- their own table with RLS enabled and NO policies at all, so no user --
-- not even the owner -- can read one through the API; and they're stored
-- AES-256-GCM encrypted with an app key (BANK_TOKEN_ENCRYPTION_KEY) that
-- never touches the database.

create table public.bank_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plaid_item_id text not null unique check (char_length(plaid_item_id) <= 255),
  institution_id text check (institution_id is null or char_length(institution_id) <= 255),
  institution_name text check (institution_name is null or char_length(institution_name) <= 255),
  status text not null default 'active' check (status in ('active', 'login_required', 'error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bank_items_user_id_idx on public.bank_items (user_id);

create table public.bank_item_secrets (
  item_id uuid primary key references public.bank_items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  access_token_ciphertext text not null,
  sync_cursor text,
  updated_at timestamptz not null default now()
);

create index bank_item_secrets_user_id_idx on public.bank_item_secrets (user_id);

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.bank_items (id) on delete cascade,
  plaid_account_id text not null unique check (char_length(plaid_account_id) <= 255),
  name text not null check (char_length(name) <= 255),
  mask text check (mask is null or char_length(mask) <= 8),
  type text check (type is null or char_length(type) <= 50),
  subtype text check (subtype is null or char_length(subtype) <= 50),
  current_balance numeric(14, 2),
  available_balance numeric(14, 2),
  iso_currency_code text check (iso_currency_code is null or char_length(iso_currency_code) = 3),
  updated_at timestamptz not null default now()
);

create index bank_accounts_user_id_idx on public.bank_accounts (user_id);
create index bank_accounts_item_id_idx on public.bank_accounts (item_id);

-- Plaid's sign convention: positive amount = money out, negative = money in.
create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.bank_accounts (id) on delete cascade,
  plaid_transaction_id text not null unique check (char_length(plaid_transaction_id) <= 255),
  date date not null,
  name text not null check (char_length(name) <= 500),
  merchant_name text check (merchant_name is null or char_length(merchant_name) <= 255),
  amount numeric(14, 2) not null,
  iso_currency_code text check (iso_currency_code is null or char_length(iso_currency_code) = 3),
  category_primary text check (category_primary is null or char_length(category_primary) <= 100),
  category_detailed text check (category_detailed is null or char_length(category_detailed) <= 100),
  pending boolean not null default false,
  created_at timestamptz not null default now()
);

create index bank_transactions_user_date_idx on public.bank_transactions (user_id, date desc);
create index bank_transactions_account_id_idx on public.bank_transactions (account_id);

alter table public.bank_items enable row level security;
alter table public.bank_item_secrets enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;

create policy "bank_items_select_own" on public.bank_items
  for select using ((select auth.uid()) = user_id);
create policy "bank_accounts_select_own" on public.bank_accounts
  for select using ((select auth.uid()) = user_id);
create policy "bank_transactions_select_own" on public.bank_transactions
  for select using ((select auth.uid()) = user_id);
-- bank_item_secrets: intentionally no policies (service role only).

create trigger bank_items_set_updated_at
  before update on public.bank_items
  for each row execute function public.set_updated_at();
create trigger bank_item_secrets_set_updated_at
  before update on public.bank_item_secrets
  for each row execute function public.set_updated_at();
create trigger bank_accounts_set_updated_at
  before update on public.bank_accounts
  for each row execute function public.set_updated_at();
