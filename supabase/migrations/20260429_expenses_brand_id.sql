alter table expenses add column if not exists brand_id uuid references brands(id);
