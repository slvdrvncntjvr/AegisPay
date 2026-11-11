# TASK-019 authorized continuation — 2026-11-10

**Capture preflight PASSED; the single actual full staging attempt FAILED, exit 1: `PRODUCTION_NEXT_START_FAILED`. TASK-019 remains unfinished.** Database TLS, time, budget and metadata prerequisites passed. Production Next readiness was not established, so no actual HTTP checks, browser cases or logins ran. This is neither hosted/deployed qualification nor TASK-012/full-MVP acceptance.

Work ref: Orca task `task_8fd0bc2e0af5`, dispatch `ctx_e52040b71ecb`. This distinct bounded continuation followed the coordinator's externally repaired exact-database client-IPv4 prerequisite. This worker made no provider call or access-policy change. All earlier reports, README, receipts, execution markers, audits and the passing proxy implementation remain byte-identical. No canonical document, Git, app source/build, identity or protected configuration was changed.

## Explicit authorization and immutable source binding

[Continuation authorization](continuation-authorization.json) links the exhausted prior actual marker, prior passing synthetic receipt, unchanged proxy source and [coordinator's repaired prerequisite evidence](../coordinator-db-diagnosis-2026-11-10/after-rule-rotation.json) by SHA-256. The original marker remains exhausted at its original path. The [new source-binding record](continuation-source-binding.json) binds the exact continuation helpers; the [new exclusive continuation execution receipt](continuation-execution.json) records the one authorized actual command and matching passing preflight. No old marker was deleted, overwritten or bypassed.

Bookkeeping changes select this new dated evidence directory, allow exactly one synthetic execution, require the explicit continuation/source binding and recognize both the old and new client IPs in memory-only hygiene checks. Fixed phase labels, an internal assertion class, and allowlisted connection/SQLSTATE categories improve exception classification without exporting arbitrary messages/stacks. No capture algorithm or synthetic navigation/assertion test was repaired or replaced in this continuation.

| Bound source | SHA-256 |
| --- | --- |
| `deployment/finals/staging-app/proxy-capture.ts` — unchanged | `56ffa717115e77e02c90aeec82cfa0ceb91804cbb9a9f4fba666c8d9bc1ac19c` |
| `deployment/finals/staging-app/capture-preflight.ts` | `80932c305f4b374135d0a001a1924934f13778f72f151adf4089d902726f1b8a` |
| `deployment/finals/staging-app/qualify.ts` | `bbe89a7273d2c2ce910c3ad233fd55c9fcdca699fb81a8e0067a119406efe1fd` |
| `deployment/finals/staging-app/continuation.ts` | `53382c1932f2487b07fc0b1ec5002ca6d481abf9ba323204ac3351ee253228f5` |

The new immutable passing receipt is [preflight-1.json](preflight-1.json), SHA-256 `7905fe54053bc27d85094300f75cf6826b6ac1afc650620806092e0adecda797`. Actual execution requires this passing outcome, complete contexts and exact matching source hashes. These bound sources were not edited afterward.

## Exact commands and exits

Commands ran from the repository root using the already installed Node 24.22.1, Playwright 1.65.0 and Chromium 156.0.8078.4. No install or download ran.

| Command | Exit | Observed result |
| --- | --- | --- |
| `node --check` for continuation, qualifier and preflight helpers | 0 | Syntax passed before execution |
| `node --import tsx deployment/finals/staging-app/capture-preflight.ts` | 0 | Sole synthetic execution, 2026-11-10T15:06:08.083Z–15:06:14.356Z; two complete independent contexts |
| `node --import tsx deployment/finals/staging-app/qualify.ts --resume` | 1 | Sole actual invocation, 2026-11-10T15:06:52.616Z–15:07:12.437Z; [actual result](actual/result.json), failure stage `production-http`, fixed category `PRODUCTION_NEXT_START_FAILED` |

There was no second synthetic execution, second actual invocation, architecture/capture repair, diagnostic reconnect or app restart after the actual failure. The subsequent new audit skips independent DB access when the actual gate failed; it uses the actual receipt's fresh cleanup checkpoint and performs offline preservation/bundle/hygiene checks.

## Capture preflight and semantic limits

The unchanged fixed-target normal Node HTTP observation proxy passed the same synthetic fixture tests: original request method/body/Host/Origin/custom-header fidelity, gzip and binary preservation with separate assertions, original status messages, content-encoding/content-length, duplicate HttpOnly/SameSite cookies, 204, redirect bodies/cookies, logout clearing, fast navigation, canceled pending requests and independent contexts. The fixture reads no DB, private login/configuration, provider, application or financial state and supplies no app/payment evidence.

The contexts recorded 12 and 9 browser requests, matching 12 and 9 upstream requests exactly, including canceled and favicon requests. Across both contexts, 21 browser requests = 21 proxy requests = 21 fixture upstream requests; every upstream body was captured, zero delivered bodies lacked prior capture, zero pending captures/browser requests remained, and zero capture/proxy failures occurred. The first context identified one canceled prefetch separately. Synthetic byte hashes and per-context fixed diagnostics remain in the receipt, including on failure paths.

Body ownership was checked before context disposal. Subsequent browser `Response.body()` retrieval after disposal failed in both contexts while the upstream bytes had already been scanned. No later GET substituted for those bodies. Canceled requests require corroborated client-socket closure plus retained/scanned upstream bytes when Chromium omits a completion event; production additionally restricts an undelivered cancellation to prefetch behavior.

The proxy binds only loopback, keeps browser origin `127.0.0.1:3037`, and uses the fixed Next upstream `127.0.0.1:3038`. It buffers requests/responses, forwards once without redirects/retries/cookie jar, scans raw and decoded compressed entities in memory, then delivers original response entities/status/status messages/duplicate raw headers through normal HTTP. CDP observes lifecycle and disables browser cache; it does not fulfill responses. Buffering changes streaming, timing and hop framing. This does not qualify unintercepted/native-browser cache behavior or hosted egress.

## Actual observed prerequisites, failure and cleanup

The real helper `createStore` connected to the exact unchanged staging database with authorized, hostname-verified TLS 1.3. Wrong-hostname rejection, strict connection parameters, server `pg_stat_ssl` TLS 1.3, helper pool maximum 1 and server connection limit 100 passed. This is helper TLS evidence; the actual app pool made no observed TLS connection.

The read-only budget transaction observed **database time 2026-11-10T15:06:58.485Z**. Owner and merchant windows were naturally expired, with five available attempts each and three required per role. The global window was naturally expired, with 50 available and six required. No login preceded this check; no throttle counter was reset, polled or waited out.

Existing migration checksums, metadata/catalog identity and prices, distinct configured public identity, policy amount 0, epoch expiry, null observed policy ledger, unprovisioned status and nonce 0 passed. The matching preserved source/build receipt was reused. No migration, seed, rebuild or configuration/secret creation occurred. The reused build record retains its historical reason string from the original build receipt; `fresh_build: false` and the matched source/build hashes identify this continuation's behavior.

Production Next was spawned as owned hidden PID **11444** on loopback port 3038; the observation proxy bound loopback port 3037. The bounded TCP readiness check did not establish readiness while the process met its expected live-state condition, and the fixed assertion failed. The receipt does not establish whether the cause was startup exit or readiness timing, nor an underlying startup error. Raw app logs were not saved: only 115 bytes, their SHA-256 and zero hygiene-match counts were recorded. No startup diagnosis or second launch followed.

No health/API/HTML/RSC/client-asset HTTP check or owner/merchant browser flow ran. Proxy requests and scanned actual response bodies were both zero; actual app-pool TLS observations were zero. Every one of the four required actual role/viewport cases remains untested in this continuation. A successful synthetic preflight or offline bundle audit cannot substitute for them.

Cleanup closed the owned proxy, confirmed the owned Next PID exited, and freshly read these actual database counts before closing the helper store:

| Table group | Counts |
| --- | --- |
| Metadata/migrations | owner 1, merchant 1, agent 1, resource 2, schema_migration 4 |
| Authentication | session 8, auth_throttle 13 |
| Sessions | total 8, revoked 8, unrevoked 0; no new session/login |
| Financial/execution | agent_run 0, quote 0, payment_attempt 0, payment_evidence 0, entitlement 0, job 0, wallet_operation 0, merchant_claim 0, run_event 0, audit_event 0, payment_accept_key 0 |

No run, quote, wallet, RPC, signing, Gemini, Velo, Noir, funding, job/wake, report grant, old financial database or provider operation was accessed. The original incident, holds and unentitled state remain untouched. No original session or throttle record was deleted, reset or revived.

## Final audit and remaining work

The [new final continuation audit](final-continuation-audit.json) verifies all 39 preserved historical public artifacts, six custody/configuration/permit files, the 72-file application source closure, BUILD_ID and 233 original build files. It scans client/server bundle boundaries and public helpers/evidence against protected findings, known secrets, full provider IDs, raw DSNs and **both** old/new client IPs in memory. It also checks that both app/proxy ports have no listener. After this actual failure, it makes no database reconnect; its fresh DB checkpoint is explicitly attributed to the actual cleanup receipt. It overwrites no original audit.

Source SHA-256 remains `1eca1bfbfc838513ced491d53aedeb5e173400e935125f45f03694e4874acc00`; BUILD_ID SHA-256 remains `8377827b6c1b2e97c1ceabca1c0a1e00b8407c51ead728dfdff07100973b9a9c`; original build inventory SHA-256 remains `3e6d864cf2f90759c110bbb283cbe53d4028a6b63c199a8a03f81662c12f07b0`. The audit and [final checks](checks.json) provide complete file fingerprints and exact observed syntax/documentation/hygiene results. Both documentation commands also passed with exit 0 at the actual attempt's end.

The external DB prerequisite is now proved, but the actual application readiness blocker remains. This scope stops at its exhausted actual marker. A separately authorized startup diagnosis is needed before any future gate; the complete real HTTP/leak/TLS checks and owner/merchant desktop/mobile matrix still require their actual acceptance evidence. Coordinator/reviewer acceptance owns the final task status.
