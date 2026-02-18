# Production State Snapshot

Date: 2026-02-18  
Admin user:  
Project ref: `qugizhwizshaqjhwefnv`

## Working Mode
- Solo administrator: `Yes`
- Schema freeze active (no ALTER/CREATE/DROP/TRUNCATE/DELETE): `Yes`
- Bulk imports paused until backup: `Yes`
- Company delete / mass delete paused until backup: `Yes`

## Active Company
- id:
- name:
- created_at:

## Table Row Counts
- products:
- customers:
- vendors:
- categories:
- sales_invoices:
- purchase_invoices:
- purchase_orders:
- purchase_returns:
- receive_payments:
- make_payments:
- stock_ledger:

## Security / Lint
- RLS on `public.users`: `Yes/No`
- Sensitive `password` column removed from `public.users`: `Yes/No`
- Security definer view issues pending: `Yes/No`
- Notes:

## Daily Operational Checks (Start of Day)
- App login works.
- Dashboard loads.
- Product list loads.
- Pending dropdown loads.
- One print preview opens.

## Daily Operational Checks (End of Day)
- Sales totals verified.
- Purchase totals verified.
- Receive/Make payment links checked.
- One stock movement verified from ledger.
- Any error seen in app captured below.

## Backup Status
- Full DB backup taken: `No`
- Backup method planned: `pg_dump / Supabase backup`
- Planned backup date:
- Backup file/path:

## Change Log (Today)
- Time:
- Change:
- Impact:
- Rollback needed: `No/Yes`

## Notes
- 

