# TASK-019 observed staging application qualification

**Outcome: failed / unfinished.** The concrete qualification ran and returned
exit 1. The third narrow repair still failed browser response-body capture;
the repair circuit breaker is reached. TASK-019 must remain unfinished. This
report does not establish a hosted app, deployed egress, full MVP, TASK-012
acceptance or any financial/chain result.

Work ref: Orca task `task_f0e5ebcaaecd`, dispatch `ctx_3d212206f9c3`, baseline
`0bf81ff36d7c2bb5bba22b5f127b9519535bf494`, application source `b2661c0`.
No Git stage, commit, push, source publication, app deployment, alias change,
provider mutation or external message occurred. Only the assigned staging
helper/evidence paths and ignored protected custody were written; the permitted
production build regenerated ignored Next build output.

## Exact commands and exits

Commands below ran from the repository root unless their working directory is
specified. All credentials travelled through protected local reads and minimal
child environments, with none in command arguments. Timestamped results retain
actual command arguments, exits and sanitized output fingerprints.

| Command | Exit | Observed result |
| --- | --- | --- |
| `node --check deployment/finals/staging-app/tls-observer.cjs` | 0 | Observer syntax passed |
| `node --import tsx deployment/finals/staging-app/qualify.ts` | 1 | [Initial receipt](2026-11-10T12-35-49-545Z/result.json): ACL helper autoload failed before DB access or secret generation; inherited PowerShell 7 module path was incompatible with Windows PowerShell 5 |
| `node --import tsx deployment/finals/staging-app/qualify.ts` | 1 | [Repair 1 receipt](2026-11-10T12-37-22-303Z/result.json): ACL verification, fresh schema, migrations, seed and production build passed; manually constructed RSC cache key received 307 and failed expectation |
| `node --import tsx deployment/finals/staging-app/qualify.ts --resume` | 1 | [Repair 2 receipt](2026-11-10T12-39-15-029Z/result.json): pinned Next RSC helper fixed the request; actual pool TLS and HTTP checks passed; desktop owner flow reached logout but response-body scanner failed |
| `node --import tsx deployment/finals/staging-app/qualify.ts --resume` | 1 | [Repair 3 receipt](2026-11-10T12-41-01-076Z/result.json): desktop owner and merchant cases completed; mobile owner reached logout/revocation but scanner failed again; mobile merchant was not attempted |
| `node --import tsx deployment/finals/staging-app/audit.ts` | 0 | [Separate final read-only audit](final-readonly-audit.json): exact staging counts, all sessions revoked, preserved source/configuration, bundle boundary and hygiene passed; failed application gate remains failed |
| `python tools/check-docs.py` | 0 | Executed at each repaired gate's end; final independent repeat recorded in final hygiene receipt |
| `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` | 0 | Executed at each repaired gate's end; final independent repeat recorded in final hygiene receipt |

The one fresh production build ran `node` with the locally resolved
`next/dist/bin/next build`, cwd `apps/web`, exit 0, starting
2026-11-10T12:37:33.797Z. Later invocations reused its matching source/build
receipt. There were no installs, package updates, peer overrides, root database
commands or unrelated test-suite repeats. Child environments set
`COREPACK_ENABLE_NETWORK=0`; no pnpm installation or network resolution ran.

## Observed database, TLS and custody

The exact Free Singapore resource is pinned by SHA-256
`feaa345c7d4172d22feb6dd8c92794128061a2f357b2e5372c0739138b6f8f85`, created
2026-11-10T11:55:40.452333Z and expires 2026-12-10T11:55:40.452333Z. The
protected host, URL, resource and lifecycle checks passed. No provisioning or
observation permit was invoked, reset or reused. The client access policy was
unchanged. Finals date remains TBA.

Before mutation, the actual public catalog had zero objects and zero routines.
The existing `src/server/db/migrate.ts` applied four checksum migrations, and
the existing `seedDemo` seeded only one owner, one merchant, one distinct new
agent/device and two resource metadata rows. Verified four public Noir contract
IDs matched the existing contract-verification artifact. No original financial
database was opened or copied. The staging policy remains amount 0, epoch
expiry, null observed ledger, status `unprovisioned`, nonce 0.

The actual `createStore` connection and the actual production Next pg pool
both observed encrypted, certificate-authorized TLS 1.3. Correct hostname
verification passed; an incorrect hostname was rejected by the TLS verifier.
PostgreSQL's own `pg_stat_ssl` independently reported TLS 1.3. Local inspection
of pinned pg 8.23.1, its connection-string parser and TLS upgrade implementation
confirmed that `sslmode=verify-full` retains Node certificate and hostname
verification. The app observer saw the exact resource, strict configuration,
pool maximum 10 and one connection at observation. The helper pool maximum
was 1; observed server `max_connections` was 100. Requests were serialized.
No TLS bypass, trust override, proxy or application source change was used.

The new owner/merchant login tokens and receipt key each came from independent
48-byte random draws. The new agent/device differ from original configured
identities. Exclusive creation, current-user/SYSTEM ACL verification before
secret bytes and atomic same-volume publication passed. The agent secret is
only in ignored protected separate custody. The protected web file contains
only allowlisted DB/public/network/auth settings: no agent, Velo, Gemini,
encryption or wake secrets, no old login tokens and no signed XDR. `AGENT_MODEL`,
`WORKER_WAKE_URL` and `TRUST_VERCEL_PROXY` are absent. The original protected
`.env.staging.local` fingerprint is unchanged.

## Actual HTTP and browser results

The latest gate recorded 37 HTTP checks, including public HTML, actual RSC,
anonymous API denial, invalid-session denial, owner and merchant login/state,
owner catalog, merchant refusal on owner-only APIs, denied nonexistent/unowned
report/receipt IDs, bad-origin login/logout, real logout and previous-cookie
rejection. All reached checks had their expected status. API and session
responses were `no-store`; cookies were HttpOnly, SameSite Strict, Path `/`,
with the permitted loopback HTTP omission of Secure. No report grant, valid
run/quote request or financial endpoint was used. Existing foreign financial
objects were not fabricated to test ownership; denial used absent object IDs.

Anonymous app HTML/RSC did not contain the new staging agent/device state.
All 16 emitted client static assets were fetched over actual HTTP and scanned.
The final offline build audit found 10 protected-finding matches in server
artifacts and zero in client artifacts, verifying the actual bundle boundary.

Desktop 1440x1000 owner and merchant each completed real browser login,
database state, reload, logout and rejection of the prior cookie. Those cases
had no page errors, external network requests, forbidden financial requests,
horizontal overflow or private browser-storage matches. Mobile 390x844 owner
reached real login/state/reload/logout and previous-cookie 401, but its case
was not accepted because the response scanner failed. Mobile merchant remains
untested. No browser routes were mocked. No traces, screenshots, videos,
storage state, cookies or raw response bodies were saved.

The remaining concrete defect is in `qualify.ts` browser response capture:
after the mobile-owner navigation/logout sequence, at least one pending body
scan rejects and sets `browser_body_scan_error`, producing
`BROWSER_RESPONSE_BODY_SCAN_FAILED`. The current sanitizing catch does not
retain a safe per-response failure category, so the exact failed resource or
underlying browser retrieval error is not established. The last run directly
captured 164 browser bodies and performed three bounded safe-GET rescans,
each yielding 401. These rescans cannot prove delivery of an earlier evicted
body. This capture limitation prevents a complete browser leak gate; it is
not evidence of an application data leak, and successful HTTP checks cannot
substitute for completing it. Further work needs safe failure classification
and a new coordinator-directed bounded repair cycle, then completion of both
mobile cases after natural login-throttle expiry.

The latest invocation scanned 229 response/DOM/storage bodies, 9,385,324 bytes,
with zero observed fixture, known-secret, full-provider-ID, raw-DSN or client-IP
matches. Unavailable bodies remain the explicitly failed coverage gap. The
returned `worker_only` model health string was verified as configuration copy;
no model availability was observed.

## Final preserved database state and process cleanup

The separate final audit opened one strict-TLS connection and used a read-only
transaction after qualification stopped. Its actual counts are:

| Table group | Counts |
| --- | --- |
| Metadata | owner 1, merchant 1, agent 1, resource 2 |
| Migration history | schema_migration 4 |
| Authentication | session 8, auth_throttle 13 |
| Financial/execution | agent_run 0, quote 0, payment_attempt 0, payment_evidence 0, entitlement 0, job 0, wallet_operation 0, merchant_claim 0, run_event 0, audit_event 0, payment_accept_key 0 |

All eight test sessions are actually revoked; zero remain unrevoked. Session
and throttle rows were preserved. At final observation, owner login attempts
were 5 and merchant attempts 3 in their active real 15-minute windows; neither
limit was relaxed or reset. Do not retry login while the owner window is active.
Cleanup updates were restricted to this invocation's known session hashes;
no original record or migration history was deleted or rewritten.

Every spawned production Next PID was recorded and confirmed exited; the final
read-only audit independently found no listener on 127.0.0.1:3037. No unrelated
PID was stopped. No model, worker, wallet refresh/prepare/submit/observe, RPC,
Velo, signing, funding, report granting or financial job ran. The original
unresolved purchase in the untouched local database remains outside this
qualification and retains its prior held/unentitled status.

## Fingerprints, evidence and limits

The 72-file tracked application closure SHA-256 is
`1eca1bfbfc838513ced491d53aedeb5e173400e935125f45f03694e4874acc00`.
The production BUILD_ID SHA-256 is
`8377827b6c1b2e97c1ceabca1c0a1e00b8407c51ead728dfdff07100973b9a9c`.
The 233-file server/static build inventory SHA-256 is
`3e6d864cf2f90759c110bbb283cbe53d4028a6b63c199a8a03f81662c12f07b0`.
Source and BUILD_ID stayed unchanged after the tested production build.

Each timestamped `result.json` and `inventory.json` preserves a real failed
attempt. The first successful migration/build run also contains its factual
pre-build checkpoint. [Build inventory](build-inventory.json) contains only
paths, sizes, hashes, client/server classification and finding-match counts.
[Final read-only audit](final-readonly-audit.json) contains counts, TLS facts,
source/build checks and hygiene inventory. `final-hygiene.json` inventories
the final helper/report set and records the final documentation checks.

Known secret values, full provider IDs, raw DSNs and the privately retained
client IPv4 were scanned in memory. Public artifacts contain only safe facts,
booleans, counts, paths and hashes; no raw errors, credentials, report findings,
sessions or XDR. Protected private custody remains ignored. No canonical plan,
ledger or product document was edited by this worker. The coordinator owns
status reconciliation and review; this evidence requires an unfinished status.
