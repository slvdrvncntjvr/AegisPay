# Isolated production application qualification (TASK-019)

The real qualification entry is:

```text
node --import tsx deployment/finals/staging-app/qualify.ts
```

Run from the repository root with the installed pinned dependencies. The entry
rejects proxy/TLS/PG overrides, automatic Next environment files, unexpected
arguments, reused initial configuration and the wrong resource or lifecycle.
It reads protected custody locally; credentials are never command arguments.
The exact resource is pinned by SHA-256, external hostname, database name,
creation/expiry and `sslmode=verify-full`. There are no Render API calls.

The initial invocation requires an empty public catalog and catalog metadata,
then calls the existing checksum migration and metadata-only seed functions.
It never imports root DB scripts or an integration environment loader. A new
agent/device and three independent 48-byte secrets are persisted exclusively
and atomically, with verified current-user/SYSTEM ACLs before secret bytes are
written. The agent secret is held only in separate ignored protected custody;
it is absent from the web environment. The app has no financial, model or wake
credentials. Original configuration and previous evidence are preserved.

`--resume` requires the protected initial-empty-schema receipt, the unchanged
web configuration, matching catalog identity, zero financial/execution rows,
revoked prior sessions and sufficient real login throttle budget. It uses a
matching build/source receipt when available. It never resets a throttle,
identity, policy, nonce, session history or migration. A resume is not a grant
to exceed the task's repair circuit breaker.

The production process is the installed Next CLI, bound to `127.0.0.1:3037`,
with a minimal child environment and hidden window. `tls-observer.cjs` observes
the actual app's pg pool connections without changing connection settings or
route behavior. The app's existing maximum is ten connections; the serial
qualification helper uses one, against an observed database limit of 100.
The observer independently checks encryption, authorized certificate, correct
and incorrect hostnames and exact resource identity. No API routes are mocked.

Actual HTTP checks cover public HTML/RSC, anonymous and invalid sessions,
owner/merchant login/state, catalog/role boundaries, bad origins, denied report
objects, logout and previous-cookie rejection. Every emitted static client
asset is fetched and scanned. Real Chromium covers desktop/mobile role flows,
state, reload and logout. Findings, credentials, session tokens and response
bodies are scanned in memory; no raw logs, traces, screenshots, video or storage
state are exported. A bounded safe GET rescan can recover a body unavailable
across navigation; mutations and financial/report endpoints are never replayed.

Every invocation creates its own safe evidence directory and returns nonzero
unless all required checks finish. API/DB or documentation success cannot turn
an incomplete browser matrix into a passing gate. The current outcome is
**failed / unfinished**; the three-repair circuit breaker has been reached.
See the [observed report](../../../docs/evidence/finals-staging-app/report.md).

The separate command below performs a strict, read-only final audit of exact
staging counts/session revocation, source/build fingerprints and bundle/secret
hygiene. Its success does not complete the failed qualification gate:

```text
node --import tsx deployment/finals/staging-app/audit.ts
```

It refuses to overwrite its final audit and inventory artifacts. Neither entry
deploys an app, changes provider access, calls a model/worker/chain, creates a
run/quote/payment/wallet operation or grants a report. Future resumption needs
coordinator direction after the circuit breaker and natural throttle expiry.
