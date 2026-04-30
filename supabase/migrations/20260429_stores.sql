CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);
