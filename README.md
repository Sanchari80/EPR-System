# Flow ERP — React + TypeScript + Supabase
1. Supabase SQL Editor: run `supabase/schema.sql`, then `02_upgrade.sql`, then `03_grants.sql` (all three, in order).
2. `cp .env.example .env` and paste your project URL + anon key.
3. `npm install && npm run dev`

## Modules
Dashboard · Sales · Purchase · Inventory · Parties · Accounts (`src/modules/*`, shared UI in `src/lib/ui.tsx`).

## Integration (atomic Postgres functions)
- `place_order` — purchase: stock +, Dr Inventory / Cr Cash + Payable. Sale: stock check, stock −, Dr Cash + Receivable / Cr Revenue, Dr COGS / Cr Inventory.
- `settle_order` — collect customer dues / pay suppliers (Cash vs Receivable / Payable).
- `add_expense` — Dr Operating Expenses / Cr Cash. `adjust_stock` — damage or found stock, valued at cost, posted to the ledger.
- Views: `account_balances`, `party_balances`, `daily_totals`, `top_products`. Supabase Realtime keeps every open device in sync.
RLS is open for the demo; add Supabase Auth policies for production.
