# Release Checklist (Dev -> Prod)

## 1) Prepare
1. Work in feature branch only.
2. Confirm changes are tested on dev environment.
3. Ensure all DB changes are in SQL migration files under `supabase/sql/`.
4. Update `go-live-state-2026-02-18.md` with current baseline.

## 2) Dev Validation
1. Frontend build passes:
   - `cd frontend`
   - `npm run build`
2. Backend starts with dev env values.
3. Smoke test flows on dev data:
   - Sales Invoice -> Receive Payment
   - Purchase Invoice -> Make Payment
   - Purchase Order -> Convert to Purchase Invoice
   - Stock movement check
   - Print test

## 3) Pre-Prod Safety
1. Take full DB backup snapshot.
2. Confirm no active bulk import/delete operations.
3. Announce release window (even if solo, record start/end time).

## 4) Deploy
1. Apply SQL migrations to prod (same order as dev).
2. Deploy frontend (prod env config).
3. Deploy backend (prod env config).

## 5) Post-Deploy Verification
1. Run `supabase/sql/go_live_snapshot.sql`.
2. Verify:
   - App login works
   - Dashboard loads
   - One test purchase invoice
   - One test sales invoice
   - One payment link (receive or make)
   - One print output
3. Check for API errors in browser console/network.

## 6) Rollback Rule
1. If critical issue is found:
   - Stop new data entry.
   - Roll back app deployment.
   - Restore DB only if data integrity is broken and restore is approved.
2. Log incident and final action in `go-live-state-2026-02-18.md`.

## 7) Env File Split (Recommended)
Use template files added to repo:
- `frontend/.env.dev.example`
- `frontend/.env.prod.example`
- `backend/.env.dev.example`
- `backend/.env.prod.example`

Create real env files locally (do not commit secrets):
- `frontend/.env.local` for active frontend environment
- `backend/.env` for active backend environment

