create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz default now()
);

alter table expenses add column if not exists store_id uuid references stores(id);

alter table stores enable row level security;

drop policy if exists stores_select on stores;
drop policy if exists stores_insert on stores;

create policy stores_select on stores
  for select using (auth.uid() is not null);

create policy stores_insert on stores
  for insert with check (auth.uid() is not null);
