# Kirayu tracker operations checklist

## Dashboard behavior

- Account lists use realtime events to patch rows already loaded by the browser.
- A two-minute query refresh is intentionally kept as a reconciliation path for missed realtime events, new rows, changed sort order, and changed filters.
- Aggregate stat tiles are refreshed at most once per 750 ms realtime burst.
- AE and MM2 generated scripts begin with a version marker. Increment `TRACKER_VERSION` whenever their payload or behavior changes.

## Required server-side safeguards

This repository is the dashboard only. The PocketBase/API service must enforce the following before the tracker is exposed to more users:

1. Require a per-user, per-game ingest token for every endpoint, including GTD. Never accept unauthenticated reports.
2. Store only a hashed token server-side; offer token rotation and immediately reject rotated tokens.
3. Validate ingest bodies with a strict schema, a maximum body size, and numeric/string bounds. Reject unknown high-volume fields.
4. Rate-limit by token and IP, make report IDs idempotent, and apply exponential backoff guidance to clients.
5. Persist `tracker_version`, `last_report_at`, `last_success_at`, `last_error_code`, and a rolling report count. Surface these fields in an account-health endpoint.
6. Add database indexes for each hot ownership/filter/sort combination: owner + `last_seen`, owner + `user_id`, and owner + each supported primary sort field. Verify the exact index syntax against the active PocketBase/SQLite schema.
7. Keep marketplace/API credentials out of browser storage when a server-side, encrypted credential vault is available. If browser storage remains necessary, provide explicit clear/revoke controls and never log those values.

## Release gate

Run these before deployment:

```powershell
npm run lint
npm run build
```

Also smoke-test: sign in, copy each tracker script, receive a live account update, filter/search, open one account detail, and rotate a tracker token.
