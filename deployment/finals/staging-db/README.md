# Free staging PostgreSQL prerequisite

This directory prepares only the independent hosted SQL prerequisite for TASK-018. It does not deploy AegisPay, change Vercel, start a worker, migrate, seed, copy a database, or authorize a payment. Coordinator owns task status, source review and commits. Finals date remains TBA.

**Actual result, 2026-11-10:** the sole authorized POST returned HTTP400; a subsequent workspace-filtered GET confirmed zero PostgreSQL instances. No database credentials or `.env.staging.local` were created and no SQL ran. The rejection message was discarded by the first helper version, so its exact reason is unknown. This is an unsuccessful provisioning attempt, not a verified billing/capacity blocker or a completed database prerequisite. See the [report](../../../docs/evidence/finals-staging-db/report.md).

## Guarded helper

From the repository root, the safe default is:

```text
python deployment/finals/staging-db/provision.py
```

The default fetches the current official schema, verifies its reviewed hash, rechecks the existing authenticated identity, sole workspace, active ADMIN membership and complete bounded database inventory. It makes GETs only, saves allowlisted observations and retrieves no connection information. It reads only `RENDER_API_KEY` from the existing ignored `.env.deploy.local` for provider authentication. It does not use Vercel credentials or read existing database contents.

`request-manifest.json` records the exact attempted body without full workspace ID or credentials. The helper resolves `ownerId` privately, checks a fixed Free PostgreSQL17/Singapore allowlist, disallows additional fields, paid plans, HA, replicas, storage autoscaling and connection-pooling addons. New environment/database user names are left to Render. Public API schema field support does not establish successful provider validation: the actual request was rejected. The submitted request included `diskSizeGB: 1`; because the response reason was not retained, do not claim that field caused the rejection or that omitting it is a proven repair.

The one-shot mutation mode is `--create-free-once`. **Do not run it to retry this incident.** The persisted `create-attempt.json` fences further POSTs, including after timeouts or HTTP errors. Do not delete/reset that receipt. The narrowly guarded `--resume-proven-undispatched` option was used exactly once for a recorded Windows filesystem failure with zero POSTs; it cannot pass against the current HTTP400 receipt. A further attempt needs coordinator review of this result and an explicit follow-up scope, not another provider key from the user.

The initial Windows failure occurred because `os.fsync` was attempted on a read-only descriptor and returned errno9. The helper now fsyncs a writable descriptor before dispatch. The original zero-POST observation and recovery provenance remain preserved. There has been exactly one actual POST.

## Connection phase, only after an owned creation

The unexecuted connection path requires HTTP201, exact owner/name/Free/version/region/configuration, actual `createdAt` and `expiresAt`, and status `available`. It never calculates expiration. For asynchronous creation, `--observe-created` performs bounded reads and requires the private resource identity to match the helper's own hashed creation receipt; it cannot adopt an arbitrary same-name database. There is no readiness polling loop or automatic POST retry.

Only this verified new resource can reach `/connection-info`. Connection values remain in memory until an exclusive ignored `.env.staging.local` is prepared with mode0600; Windows additionally receives a protected current-user/SYSTEM DACL verified before any secret write. Existing environment files are never overwritten. The provider key is not copied. Only the external DSN with `sslmode=verify-full` and private resource/lifecycle metadata are stored; an internal DSN is not installed or uploaded anywhere.

`verify-connectivity.mjs` receives exact resource credentials through an in-memory child environment, never arguments. Installed `pg`8.23.1 gets explicit host/user/database/password fields and TLS certificate plus hostname validation (`rejectUnauthorized: true`, SNI and TLS1.2 minimum). URL SSL options cannot replace those explicit settings. It permits only `SELECT 1 AS one` and `SHOW server_version`, with bounded connection/query/statement timeouts and a read-only session. It loads no app/integration environment, opens no existing database, and runs no migration or seed. This path has only a syntax check; no cloud TLS or SQL pass is claimed.

Provider requests have20-second timeouts, no redirects or retries, a512KiB response bound and a4MB public-schema bound. Workspace/database lists cap at20/100 records and refuse ambiguous or truncated custody. Recorded rate-limit counters are API request limits, not hosting quotas. Raw responses, headers, exception messages, credentials and full resource IDs are excluded from artifacts.

## Validation

```text
node --check deployment/finals/staging-db/verify-connectivity.mjs
python deployment/finals/staging-db/audit.py
```

The audit parses Python without creating bytecode, scans these owned artifacts against known credential values entirely in memory, checks for raw Render IDs/DSNs, and runs the two documentation gates. It does not connect to a database or start any app, worker, model or payment process. Results live in [checks.json](../../../docs/evidence/finals-staging-db/checks.json).

Official references: [Render API schema](https://api-docs.render.com/openapi/render-public-api-1.json), [create endpoint](https://api-docs.render.com/reference/create-postgres), [Free limits](https://render.com/docs/free), [connection and TLS rules](https://render.com/docs/postgresql-creating-connecting), [regions](https://render.com/docs/regions).
