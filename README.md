# KNOWBOTH.AI
> Know Your Savings. Know Your Spending.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in your keys
2. Run `npm install`
3. Run your Supabase schema (supabase/schema.sql already applied)
4. Run `npm run dev`
5. Open http://localhost:3000

## Keys needed
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY

## Stack
Next.js 14 + Supabase + Claude API + Vercel
