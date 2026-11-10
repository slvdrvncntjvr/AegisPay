# Corrected Free PostgreSQL creation — 2026-11-10

**Result: created, pending readiness at the one authorized immediate observation.** The separate minimal request returned **HTTP201** and created `aegispay-finals-staging`, Free PostgreSQL17 in Singapore, resource `dpg-db…q0-a`. The immediate GET returned **`creating`**, not available. No later provider observation, connection-info retrieval, `.env.staging.local`, SQL, migration or seed occurred. This dispatch completes the authorized bounded creation attempt; the full TASK-018 connectivity prerequisite and TASK-012 release are not complete.

Actual provider lifecycle values from that GET are **`createdAt: 2026-11-10T11:55:40.452333Z`** and **`expiresAt: 2026-12-10T11:55:40.452333Z`**. These were read from the response, never computed from today's date. Finals date remains **TBA**. Current readiness after that observation is unknown.

## Observed custody and configuration

| Check | Actual result |
|---|---|
| Authorization | Separate dispatch `ctx_e6d7791811dd`; at most one corrected POST, same name/workspace/Free17/Singapore |
| Workspace | Sole accessible My Workspace `tea-cu…ctmg`; full identity SHA256 matches prior custody; active ADMIN rechecked |
| Inventory before POST | Complete workspace-filtered list, limit100; zero PostgreSQL instances and zero exact-name matches |
| Public schema | HTTP200,441718bytes; SHA256 `569ee51f78fd5991732e98552bf60d3d9f5fe16947f70b9cccdb42fa216253b0`; minimal fields/enums checked |
| Corrected POST | Exactly1, at11:55:37UTC; HTTP201,731-byte response |
| Immediate status GET | Exactly1, initiated11:55:39UTC; HTTP200,722-byte response; status `creating` |
| Observed resource | `aegispay-finals-staging`, `dpg-db…q0-a`, Free, PostgreSQL17, Singapore, primary, not suspended |
| Features | HA false; disk autoscaling false; pool none; zero read replicas |
| Storage response | `diskSizeGB` not returned, projected as null; no custom size sent; Free's fixed1GB is a published limit rather than a measured SQL/storage result |
| IP rules response | Empty list; no external-connectivity claim or IP-rule mutation |
| Credentials / SQL | Connection info not requested; no staging credential file; zero DB connections and SQL statements |
| Prior artifacts | All22 original/diagnosis files, including the original13, remain byte-identical |

The resource's full ID is not in public artifacts. Its SHA256 for a later custody check is `feaa345c7d4172d22feb6dd8c92794128061a2f357b2e5372c0739138b6f8f85`. A future separately authorized observation must rediscover the exact name only within the intended workspace, match this identity hash and actual creation metadata, and refuse any duplicate or adopted resource.

The actual request contained only `name`, `plan`, `version`, `region` and privately bound `ownerId`. No disk, HA, autoscaling, pool, replica, addon or environment fields were included. [Corrected manifest](../../../../deployment/finals/staging-db/corrected-2026-11-10/manifest.json), [prior primary-source diagnosis](../diagnosis-2026-11-10/report.md).

## Actual run and local guard findings

The [durable new attempt receipt](attempt-receipt.json) was exclusively created, flushed, fsynced through a writable handle and read back before POST. It has a distinct operation identity and preserves the original exhausted receipt's hash. It remains immutable; no reset or retry occurred. The [actual observation](observation-20261110T115540233366Z.json) retains every bounded request status and allowlisted resource field. There were seven authenticated Render calls plus the public-schema GET in that invocation, including exactly one POST and one immediate status GET. No later Render calls were made.

The command itself stopped on `NEW_RESOURCE_IDENTITY_OR_LIFECYCLE_CHANGED` after creation because it compared lifecycle strings literally. POST serialized `createdAt` as `2026-11-10T11:55:40.452332725Z` and expiry as `2026-12-10T11:55:40.452332725Z`; GET rounded them to `.452333Z`. Both actual snapshots report `creating` and matching projected resource/configuration. The raw observation and command stop are preserved. An [offline assessment](result-assessment.json) records the HTTP201 creation and pending status without a new provider call, while retaining both timestamp representations and the command's original result.

The new helper's comparison was corrected **after that invocation**, using equality rounded to the less precise supplied fractional representation for the same UTC second, while retaining exact ID checks. Offline regression tests cover these actual serialized values and reject changed seconds, dates or microseconds. No network command was rerun after this repair, and the corrected operation remains fenced. This assessment does not claim a successful connection or current readiness.

Before POST, [the first local-only preflight](observation-20261110T115010927303Z.json) stopped at the ACL probe with zero network calls. Windows PowerShell's module autoload failed; explicit modules and then PowerShell7 still encountered `PrivilegeNotHeldException` on `Set-Acl`, including a DACL-only object attempt. After these unsuccessful approaches, native `icacls` changed only the invocation-created nonsecret probe's DACL, and an independent readback verified protected current-user/SYSTEM FullControl rules with no inherited access. No owner/SACL privilege change was needed. This factual repair record is local only; it is not a cloud or application test.

The [successful local preflight](observation-20261110T115441439522Z.json) then proved writable fsync/readback, the restrictive DACL pattern, ignored/absent staging environment, Python/TLS-helper syntax, installed `pg`8.23.1, the exact minimal manifest and unchanged prior files. The actual invocation repeated those local guards before its fresh schema/account/inventory checks.

## Prepared connection path and preserved boundaries

The separate [helper](../../../../deployment/finals/staging-db/corrected-2026-11-10/provision_corrected.py) permits only one corrected POST. A persisted receipt fences restart, and a process-local dispatch marker fences a second call. Transport ambiguity and every error stop without automatic retry. The existing bounded fixed error classifier is invoked on rejection bodies in memory before discard; the actual successful201 did not exercise that branch against Render. Only safe local classifications and API rate counters can enter evidence; raw responses, headers, keys, passwords, DSNs and error strings are excluded.

If its one immediate read had been available, it would retrieve only that exact new resource's connection information, create `.env.staging.local` exclusively, apply the same independently verified native DACL before any secret write, and invoke the existing `pg` smoke helper with certificate/hostname validation, SNI and TLS1.2minimum. Only bounded `SELECT 1 AS one` and `SHOW server_version` are allowed. That conditional phase **did not run**. No TLS validation is disabled, credentials are never arguments, and no secret is uploaded to a service.

Existing services and the actual financial/integration database were untouched. There was no worker/queue/model/Gas/payment startup or call, signing, quote, registration, funding, seed, migration, state copy, Git mutation/push, app deployment, Vercel setting/alias change or secret upload. Account billing/payment-method/verification state and remaining Free usage were not inspected. No paid, alternate-region or unrelated-resource fallback occurred.

Render documents Free PostgreSQL as one active instance per workspace with fixed1GB storage, expiration30days after creation, and deletion after the further14-day upgrade grace period. This report uses the actual response expiry above, and no payment or upgrade is authorized. [Official Free limits](https://render.com/docs/free). The supported minimal field names come from the [current create endpoint](https://api-docs.render.com/reference/create-postgres); external connections require the [documented TLS connection path](https://render.com/docs/postgresql-creating-connecting).

## Validation and handoff

[checks.json](checks.json) records9 offline synthetic corrected-operation guard tests,8 offline error-classifier tests, syntax checks, documentation gates, known Render-key matching entirely in memory, DSN/raw-ID pattern checks, local links and preservation of22 prior artifacts. These tests do not establish hosted SQL readiness. [Preservation baseline](preserved-artifacts.json).

**Next:** coordinator may separately authorize a bounded identity-matched readiness observation and, only when available and otherwise eligible, private connection retrieval plus strict minimal TLS SQL. Do not create another database or reset either receipt. Migrations, seeds, app/worker previews and final release remain separate after source review and their required gates.
