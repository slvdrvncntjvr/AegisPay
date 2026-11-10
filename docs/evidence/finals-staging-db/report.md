# Independent Free staging PostgreSQL attempt — 2026-11-10

**Result: not provisioned.** The single Free PostgreSQL create POST returned **HTTP400** at11:07:40–11:07:41UTC. The rejection message was discarded by the helper, leaving only local classification `PROVIDER_REQUEST_REJECTED`; this is not a provider error code. Its cause is unknown, so billing, verification, capacity, permission and request-field failures are not established. The subsequent authenticated workspace inventory remained empty. No database, credentials, TLS connection or completed TASK-018 prerequisite is claimed; coordinator owns task status. TASK-012 and full app deployment remain unfinished.

## Actual observations

| Check | Observed result |
|---|---|
| Source | Local HEAD `577b84485b00634c8566060ff8a477dc0e030ba1`; no Git write/push |
| Authentication | Existing `.env.deploy.local` key used privately; caller matches prior authenticated identity |
| Workspace | Sole accessible workspace, My Workspace, `tea-cu…ctmg`; caller ADMIN and active, rechecked before POST |
| Pre-create inventory | Zero PostgreSQL instances; list limit100, complete; no exact `aegispay-finals-staging` |
| Current official schema | HTTP200,441718bytes; SHA256 `569ee51f78fd5991732e98552bf60d3d9f5fe16947f70b9cccdb42fa216253b0` |
| Requested resource | `aegispay-finals-staging`; Free, PostgreSQL17, Singapore,1GB; HA/autoscaling off, no replicas, no managed pool/addons |
| Actual POST | Exactly1; HTTP400;48-byte response, body not retained; no retry |
| Post-result inventory | HTTP200 at11:08:53UTC, zero PostgreSQL instances |
| Created resource ID/status/region/plan | Not applicable: no resource created; request values are not observed resource values |
| Actual `createdAt` / `expiresAt` | Not applicable; never calculated or inferred |
| Private staging environment | Not created; `.env.staging.local` is Git ignored |
| SQL/TLS | Zero connection attempts; neither `SELECT 1` nor `SHOW server_version` ran |
| Existing services/database state | No detail/env/log/DB queries, mutations, resume, delete or repurposing |
| Financial/public effects | No payment, Noir/Velo/RPC/model call, job/worker startup, migration, seed, copied records, Vercel change, deploy, source push or secret upload |

The earlier authenticated-access findings are corroborated for workspace custody and empty DB inventory. Account billing plan, payment-method/verification state, remaining Free hours/build minutes/bandwidth and spend settings remain unknown; supported account reads expose none of those. API rate counters are retained as request-rate observations only. No billing portal, signup, card entry, paid plan, HA, replica, autoscaling or unrelated service change was attempted. [Prior authenticated access](../finals-preflight/authenticated-access-2026-11-10.md).

## Evidence and exact request

- [Initial read-only check](observation-20261110T110625219218Z.json)
- [Local pre-dispatch failure, zero POSTs](observation-20261110T110645159671Z.json)
- [Actual HTTP400 create result](observation-20261110T110741492871Z.json)
- [Post-result read-only inventory](observation-20261110T110853800186Z.json)
- [Durable one-POST receipt and preserved recovery history](create-attempt.json)
- [Schema hash and extracted field definitions](schema-review.json)
- [Request manifest](../../../deployment/finals/staging-db/request-manifest.json)
- [Guarded helper and reproduction notes](../../../deployment/finals/staging-db/README.md)
- [Offline hygiene, syntax and documentation checks](checks.json)

The manifest records the exact body except `ownerId`, resolved privately from the verified sole workspace. Its fields exist in the current official OpenAPI schema, including `diskSizeGB`. Schema support alone does not establish semantic acceptance for the Free plan. The actual request contained `diskSizeGB: 1`; the discarded error cannot establish whether this or another condition caused the rejection. No unsupported repair, alternate region, paid fallback or second POST was attempted. [Official create endpoint](https://api-docs.render.com/reference/create-postgres), [official current schema](https://api-docs.render.com/openapi/render-public-api-1.json).

The helper initially hit Windows errno9 while fsyncing a read-only descriptor before dispatch. The saved observation has zero POST requests and zero create attempts. A local check reproduced errno9 and confirmed writable-handle fsync succeeds; the helper was corrected, and its narrowly guarded recovery preserved the original history. Only the subsequent request reached Render. The current receipt records HTTP400 and permanently refuses that recovery path; do not remove/reset it to retry.

## Free lifecycle and later handoff

Current published Render Free limits are one active PostgreSQL instance per workspace, fixed1GB storage, expiry30days after creation, and deletion after a further14-day upgrade grace period. Free PostgreSQL has no backups or managed connection pooling and may restart or undergo maintenance. These are published constraints, not a creation or expiry receipt. Finals date remains **TBA**, so a future accepted resource's actual `expiresAt` must be considered before rehearsal. No payment/upgrade is authorized by this report. [Render Free documentation](https://render.com/docs/free).

Singapore is a documented region and appears in the API schema; actual capacity was not proven. Future worker and DB should use the same region. External Render connections require TLS; the prepared but unexecuted smoke helper validates the certificate and hostname with SNI, TLS1.2minimum and strict `pg` SSL settings. There is no disabled certificate check. [Render regions](https://render.com/docs/regions), [Render connection and TLS documentation](https://render.com/docs/postgresql-creating-connecting).

**What remains:** coordinator must review the unsuccessful HTTP400 result and decide a separate follow-up before another mutation. The precise rejection cause was not preserved, so this result does not satisfy the requested precise external-blocker success branch. No credential needs to be supplied again: the existing key still authenticates successfully. A future successful create must record actual lifecycle values, save secrets privately and verify exactly the new database through bounded TLS SQL reads; migrations, seeds and worker/app preview remain separate after final source review.

Validation is limited to helper syntax, memory-only known-secret/raw-ID/DSN scanning and the two documentation gates in `checks.json`. No application test, hosted connectivity pass, live purchase, full release or public promotion is inferred.
