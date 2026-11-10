# Same-resource readiness and strict connection attempt — 2026-11-10

**Result: available database verified; minimum SQL/TLS prerequisite failed.** The existing `aegispay-finals-staging` resource `dpg-db…q0-a` matched the expected identity SHA256, workspace, Free PostgreSQL17/Singapore configuration and actual lifecycle timestamps. Its sole authorized direct status GET returned **`available`**. Exact-resource connection information was retrieved privately and saved atomically to ignored `.env.staging.local` with the required restrictive DACL. The single strict `pg` attempt then returned **`STAGING_CONNECTIVITY_FAILED`**, with **zero SQL statements**. No retry or TLS-validation bypass occurred. TASK-018's minimum connectivity prerequisite and TASK-012 release are not complete.

The helper's safe code does not identify the underlying socket, authentication or TLS reason. It did not retain raw exception text, and this dispatch made no second connection to recover it. No successful TLS protocol/certificate/hostname observation or SQL server version is claimed. PostgreSQL17 is confirmed by the provider metadata only; `SHOW server_version` did not run.

## Actual bounded observations

| Check | Actual result |
|---|---|
| Follow-up scope | Dispatch `ctx_a647d6664b63`; GET-only same-resource observation plus one minimal connection attempt |
| Workspace | Sole My Workspace `tea-cu…ctmg`; full identity hash matches immutable corrected receipt; active ADMIN rechecked |
| Discovery | Complete workspace-filtered list, limit100; one database and one exact-name match |
| Resource custody | Full ID SHA256 matches `feaa345c7d4172d22feb6dd8c92794128061a2f357b2e5372c0739138b6f8f85`; name/owner/configuration and precision-aware lifecycle match |
| Direct status | Exactly1 GET at12:07:35UTC; HTTP200, `available`, not suspended, primary |
| Plan and features | Free, PostgreSQL17, Singapore, HA false, autoscaling false, pool none, zero read replicas |
| Actual `createdAt` | `2026-11-10T11:55:40.452333Z` |
| Actual `expiresAt` | `2026-12-10T11:55:40.452333Z`; observed, never calculated |
| Returned storage/IP fields | No custom disk-size value; zero IP allowlist entries |
| Connection-info retrieval | Exactly1 GET for the verified resource; HTTP200; sensitive values not emitted |
| Private persistence | Exclusive private temp, current-user/SYSTEM DACL verified before secret write, writable fsync/readback, atomic non-overwriting hardlink publication, post-publication DACL verification, temp link removed |
| Private destination | `.env.staging.local`, Git ignored; provider key not copied; no existing file overwritten |
| SQL connection process | Exactly1 invocation of the unchanged existing `pg` helper; safe code `STAGING_CONNECTIVITY_FAILED` |
| SQL statements | Zero; neither `SELECT 1 AS one` nor `SHOW server_version` executed |
| Actual TLS session | Not verified; encrypted/authorized/protocol success fields absent from result |
| Provider mutations | Zero POST/PATCH/DELETE; no create, update, deletion, paid selection or IP-rule change |

There were six authenticated GETs total: caller, workspace discovery, caller role, workspace-filtered database discovery, one direct database status, and one exact-resource connection-info retrieval. No other database detail, existing financial/integration DB query, later status read, polling or connection retry occurred. [Actual sanitized observation](observation-20261110T120740197816Z.json).

## Possible external-access constraint, with limits

The actual status response returned an empty IP allowlist. Render documents that clearing the allowlist disables external access, and its Blueprint reference states that an empty list blocks all external connections. **Inference:** the observed empty policy is a concrete possible blocker for this external connection. It is not proof of the exact `STAGING_CONNECTIVITY_FAILED` cause, because the unchanged connection helper retained only its fixed fallback code. No account/network setting was changed to test that inference. [Render external-access documentation](https://render.com/docs/postgresql-creating-connecting#restricting-external-access), [empty-list semantics](https://render.com/docs/blueprint-spec#inbound-ip-rules).

Render documents managed TLS on external connections, TLS1.2-compatible clients and SNI. The existing helper used the exact external hostname, explicit SNI, TLS1.2minimum, certificate validation and hostname checks. It parsed connection fields explicitly rather than passing URL SSL parameters that could replace the SSL object. These were enforced settings, not a successful handshake observation. [Render TLS guidance](https://render.com/docs/postgresql-creating-connecting#external-connections), [node-postgres SSL parameter behavior](https://node-postgres.com/features/ssl).

## Guarded execution and privacy

The [new manifest](../../../../deployment/finals/staging-db/connect-2026-11-10/manifest.json) permits GET only, caps direct status and connection-info reads at1 each and caps the SQL process at1. The [durable observation permit](observation-permit.json) was exclusively written, flushed/fsynced and read back before provider access. It fences this dispatch against restart/retry. Neither earlier create receipt was changed or reset.

The [local preflight](observation-20261110T120652126332Z.json) proved atomic exclusive publication and DACL retention with a nonsecret probe, verified the original creation receipt/HTTP201 assessment, validated source/`pg`8.23.1 availability and confirmed the private target/temp were absent and ignored. These guards ran again before the actual observation.

The [new helper](../../../../deployment/finals/staging-db/connect-2026-11-10/observe_connect.py) reused only pure prior custody/time checks and the unchanged existing strict SQL helper; it never invoked an earlier provider-write or create path. Private connection values stayed in process memory, the protected ignored file and the SQL child's environment. They never appeared in arguments, reports, headers, console output or service uploads. No credential fingerprint was saved. The temporary secret link was removed after atomic publication; the protected `.env.staging.local` remains available for a separately authorized later phase.

All **38 prior artifacts**, covering the original13, diagnosis and corrected-operation history, remain byte-identical. [Preservation baseline](preserved-artifacts.json), [final checks](checks.json). Source HEAD changes were not used as resource identity checks.

No migration, seed, copied financial/live state, worker/queue/model/Noir/Gas/payment call, signing, funding, quote, registration, app edit/deploy, Git mutation/push, alias setting or secret upload occurred. Finals date remains **TBA**; actual resource expiration remains the provider value above.

## Validation and handoff

Six offline synthetic tests cover exact custody/lifecycle, Free configuration, the direct-GET cap, connection-info gating, atomic publication collision and consumed-permit restart refusal. Syntax checks, both documentation gates, local links, prior-file hashes and memory-only known Render-key/DB-credential plus raw-ID/DSN scanning are recorded in [checks.json](checks.json). These checks do not change the failed connection result or establish application readiness.

**Next:** coordinator must review the failed strict connection and observed empty IP policy before defining any new scope. This dispatch authorizes no retry, resource/network update, broader access rule, internal-URL fallback, disabled TLS validation, overwrite of the saved environment, or migration. The exact underlying connection reason remains unknown beyond the retained safe code. No new credentials are needed from the user merely to inspect this saved evidence.
