# Existing staging database observation and strict connection

Actual result: existing Free PostgreSQL17/Singapore resource is available with matching custody and lifecycle; private credentials were saved atomically, but the single strict connection failed with `STAGING_CONNECTIVITY_FAILED` before SQL. See the [report](../../../../docs/evidence/finals-staging-db/connect-2026-11-10/report.md).

The observation permit is consumed. **Do not rerun the network/connection command, overwrite `.env.staging.local`, reset either create receipt or modify provider settings.** A new coordinator scope is required for any further action. An empty provider IP allowlist is recorded as a possible external-access blocker; the actual failure reason was not retained by the existing SQL helper.

`observe_connect.py` contains only GET provider calls, bounded discovery, exact resource/lifecycle checks, one direct status read, one conditional connection-info read and one strict SQL process. Credentials were written only after a protected current-user/SYSTEM DACL was independently read back. Publication used an exclusive atomic hardlink after writable fsync/readback and retained the protected DACL. No private temporary link remains.

Offline checks:

```text
python -B deployment/finals/staging-db/connect-2026-11-10/test_guards.py
python -B deployment/finals/staging-db/connect-2026-11-10/checks.py
```

The audit reads the existing Render key and newly saved private DB values solely in memory for hygiene and custody/permission checks. It emits no values or credential fingerprints, makes no network/SQL call, and preserves all prior artifacts.
