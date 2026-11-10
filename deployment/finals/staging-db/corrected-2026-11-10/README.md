# Separately authorized corrected Free creation

Actual result: **HTTP201, created pending** at the one immediate status GET. No SQL, connection credentials or staging environment file exist from this dispatch. See the [report](../../../../docs/evidence/finals-staging-db/corrected-2026-11-10/report.md).

The manifest binds exactly one corrected POST to dispatch `ctx_e6d7791811dd`. The helper retains the original operation's exhausted receipt and every original/diagnosis artifact unchanged. Its new immutable `attempt-receipt.json` now fences this operation too. **Do not execute another POST or reset either receipt.**

The executed request used only name, Free plan, version17, Singapore and verified private workspace ID. Disk size and all optional features were omitted based on the primary-source diagnosis. Local fsync, DACL and package guards passed before fresh schema, sole active ADMIN and empty-inventory checks.

The actual command stopped after HTTP201/creating because POST and GET serialized lifecycle timestamps at different precision. The preserved observation records that stop; `assess_offline.py` derived creation-pending from the same actual snapshots without a new network call. The timestamp comparison fix has offline tests only. A later readiness observation is a separate authorization; this helper deliberately has no follow-up polling mode.

Offline checks:

```text
python -B deployment/finals/staging-db/corrected-2026-11-10/test_guards.py
python -B deployment/finals/staging-db/test_future_error_classifier.py
python -B deployment/finals/staging-db/corrected-2026-11-10/checks.py
```

`checks.py` reads only the existing Render provider key for an in-memory known-value scan, not an account call. It parses source, checks prior hashes/local links, runs offline/syntax/documentation gates and writes only this corrected operation's checks. It never loads or queries an application database, worker or payment runtime.
