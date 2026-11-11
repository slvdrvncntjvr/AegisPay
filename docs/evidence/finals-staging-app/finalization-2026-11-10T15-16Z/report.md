# TASK-019 F1/F2 repair and bounded qualification — 2026-11-10

**Tooling checks, exact startup diagnosis and refreshed capture preflight passed. The sole actual full gate FAILED, exit 1, during the first browser case. TASK-019 remains unfinished.** Actual startup, app-pool TLS, all 37 HTTP security checks and 16 client-asset scans passed; no complete owner/merchant desktop/mobile browser case passed. No hosted deployment, TASK-012 or full MVP is claimed.

Work ref: Orca task `task_eb0e2e40e433`, dispatch `ctx_7ffda5859c9c`. This is a distinct coordinator-directed bounded scope following the [independent F1/F2 review](../../finals-review/staging-app-2026-11-10/report.md). Historical reports/receipts/audits/markers and private custody remain unchanged. The proxy source remains byte-identical. No canonical doc, Git, application source/build, identity/configuration, migration, seed, package, provider policy, deployment or alias was changed.

## Review disposition

**F1 — addressed for the new terminal protocol and supported consumer.** `evidence-terminal.ts` validates serialized result/inventory/finalization content before publication, writes the inventory first, then the provisional result, then an exclusive terminal receipt binding both hashes and the expected exit. A result alone explicitly does not establish acceptance. An external command runner records the actual observed process exit and finalization hash. `readTerminal` and the new `final-audit.ts` require all four consistent artifacts, matching outcome/exit semantics, result-inventory binding and inventory file fingerprints. A missing receipt or mismatched exit fails closed. Historical audit commands are preserved historical tools; use the new terminal consumer for this scope.

Seven offline synthetic cases exercise successful finalization, validation failure, inventory-write boundaries, failure after result publication, failure before finalization and an inconsistent observed exit. Both offline check executions passed. In the after-result faults, a provisional `passed` result exists but is rejected because terminal acceptance is absent; an observed exit 1 also rejects a finalized expected-exit-0 fixture. Modeled exits in these synthetic tests are labeled synthetic and are not application/process evidence. The second execution checks the final protocol implementation. No DB/config/network was used by these checks.

**F2 — addressed.** The shared production launcher records fixed `READY`, `SPAWN_ERROR`, `NATURAL_EXIT` or `READINESS_TIMEOUT` classifications; pre-cleanup exit/signal values; allowlisted spawn-error category; probe results/counts/elapsed time; safe log categories; log bytes/hash and observed app-pool TLS count. It records these before owned cleanup can kill the child. Offline taxonomy checks exercise all four classes; actual startup observations establish READY only. Probe limits remain 40 probes, 500 ms per probe and 250 ms between unsuccessful probes; no blind timeout increase occurred.

The startup-only diagnosis used the actual unchanged protected web configuration, exact minimal child environment, installed Next CLI, existing TLS observer, upstream port 3038 and the unchanged proxy on port 3037. It reached **READY in 531 ms / three TCP probes**, with null pre-cleanup exit/signal, no spawn error and READY/NEXT banner categories. It issued no health/API request: proxy requests and app-pool TLS observations were zero. Owned PID 21668 was confirmed stopped. This concretely establishes current readiness and does not establish the cause of the earlier unclassified startup failure.

## Commands, limits and outcomes

All commands ran from the repository root using installed Node 24.22.1, Playwright 1.65.0 and Chromium 156.0.8078.4. No install or download ran.

| Command | Executions / exit | Observed evidence |
| --- | --- | --- |
| `node --import tsx deployment/finals/staging-app/tooling-checks.ts` | 2 / both 0 | [Offline check 1](offline-check-1.json), [final offline check 2](offline-check-2.json), seven fault cases and four startup classes each |
| `node --import tsx deployment/finals/staging-app/startup-only.ts` | 1 / 0 | [Startup-only receipt](startup-only-1.json), READY with no HTTP/app-pool TLS activity; second allowed launch unused |
| `node --import tsx deployment/finals/staging-app/capture-preflight.ts` | 1 / 0 | [Sole refreshed preflight](preflight-1.json), unchanged capture tests and algorithm; two complete contexts |
| `node --import tsx deployment/finals/staging-app/qualify.ts --resume` | 1 / 1 | [Actual result](actual/result.json), 2026-11-10T15:26:00.735Z–15:26:47.449Z; failed at `real-browser` |

The two offline protocol checks plus one startup-only diagnosis fit the three narrow tooling-check execution bound. There was one refreshed capture preflight and one actual invocation. No second actual invocation, post-preflight bound-source edit, proxy repair, automatic retry or extra startup launch followed the actual failure. The [new authorization](continuation-authorization.json), [repair prerequisite hashes](repair-prerequisites.json), [source binding](continuation-source-binding.json) and [exclusive actual marker](continuation-execution.json) retain links to the exhausted historical marker and prior evidence.

## Actual gate: reached evidence and remaining blocker

The exact helper database connection passed authorized TLS 1.3, correct/incorrect hostname tests, strict configuration and PostgreSQL SSL/identity checks. The read-only budget guard observed database time **2026-11-10T15:26:05.108Z**; owner/merchant/global windows were naturally expired with sufficient remaining budget. No counter reset, expiry wait or premature login occurred. Existing metadata, prices, migration checksums, unprovisioned policy amount 0, epoch expiry, null observed policy ledger, nonce 0 and original source/build identity passed.

Actual Next reached **READY in 533 ms / three TCP probes**, with null exit/signal and no spawn error. Before cleanup it remained READY/alive, with null exit/signal; its elapsed time was 39,368 ms. The actual app's pg pool independently observed authorized TLS 1.3, matching resource, strict certificate/hostname verification, wrong-host rejection and pool maximum 10. This is actual application-pool evidence, distinct from helper TLS.

All **37 pre-browser HTTP checks** returned their expected statuses. They include original public HTML/RSC, anonymous/invalid-session denial, actual owner/merchant login/state/logout, catalog/role boundaries, absent report/receipt/run denials, origin enforcement and revoked-cookie checks; the original nonmutating run reads were retained. All 16 emitted static client assets were fetched/scanned. The four separate previous-browser-cookie checks would bring a complete run to at least 41 HTTP checks; they were not reached and the threshold was not lowered.

The first desktop-owner browser case reached its initial anonymous app-to-login transition. It did **not** reach browser login. Its context recorded 23 browser requests = 23 upstream requests, all 23 upstream bodies captured and all 23 delivered responses matched to prior capture, with zero missing delivered bodies and zero pending capture work. One browser Network lifecycle request nevertheless remained unfinished; the fixed diagnostic is **`DRAIN_TIMEOUT_AFTER_TRANSITION`**, with pending browser requests 1 and capture failures 1. The top-level safe failure is `QUALIFICATION_ASSERTION_OR_DEPENDENCY_FAILED` at `real-browser`; no arbitrary exception message/stack was exported.

The receipt does not identify the exact unresolved request or prove why its completion event was absent. This is a remaining capture/lifecycle qualification blocker, not established app data leakage, and not proof that the full case completed. No proxy source change was made after observing it. Desktop owner is incomplete; desktop merchant, mobile owner and mobile merchant were not attempted. Zero complete browser cases are accepted.

The proxy completed 77/77 actual upstream body captures, with zero transport failures and zero pending upstream work. The in-memory leak scanner performed 165 response/representation scans totaling 3,497,795 bytes with zero protected-finding, known-secret, full-provider-ID, raw-DSN or old/new client-IP matches. This includes raw/decoded and direct-HTTP scan invocations, not 165 distinct browser responses. Full original build verification before app startup checked all 233 files, client protected-finding matches 0 and server matches 10; the final independent offline audit rechecks preservation after the failed run.

## Cleanup and finalization truth

The two real HTTP logins created two sessions; browser login was not reached. Cleanup freshly observed:

| Table group | Counts |
| --- | --- |
| Metadata/migrations | owner 1, merchant 1, agent 1, resource 2, schema_migration 4 |
| Authentication | session 10, auth_throttle 15 |
| Sessions | total 10, revoked 10, unrevoked 0; prior eight remain revoked |
| Financial/execution | agent_run 0, quote 0, payment_attempt 0, payment_evidence 0, entitlement 0, job 0, wallet_operation 0, merchant_claim 0, run_event 0, audit_event 0, payment_accept_key 0 |

Throttle/session history was preserved. Revocation updates were restricted to this invocation's known session hashes. The owned proxy closed and owned Next PID 20888 exited by cleanup SIGTERM. The actual app log stayed in memory: only 379 bytes, hash and zero hygiene counts were recorded. No raw log, body, cookie, private IP or credential was saved. No original financial database, financial handoff, run creation, quote, wallet/RPC/signing/model/provider/chain, job/wake, funding or report-grant operation occurred.

Terminal evidence consistently records a **failed** gate and observed **exit 1**:

| Artifact | SHA-256 |
| --- | --- |
| [Result](actual/result.json) | `96286d3e04c4812b580f626612e7d837bc72f9dcfbff4b810ce763781be72f5d` |
| [Inventory](actual/inventory.json) | `6e46a76ad88dbc7604c2525ddcf340eceedb6468c20fe2a756904fc965855a60` |
| [Exclusive finalization](actual/finalization.json) | `cdcc9eb3f3d4e88abd7931074391524b2038c06c1b4010141d0bb811200ffab6` |
| [Externally observed process exit](actual/observed-exit.json) | `d9d3737a2c9d9c0de937be6fb254c71382d8d278ed75bae8c24ad3ec03ae7524` |

`readTerminal` accepts the binding as internally consistent and returns `passed: false`. The new audit requires this protocol rather than inferring an exit from `result.outcome`. There is no terminal success or source publication from documentation checks.

## Final source binding, audit and limits

All paths below are under `deployment/finals/staging-app/`; none changed after the sole refreshed preflight:

| File | SHA-256 |
| --- | --- |
| `proxy-capture.ts` — unchanged | `56ffa717115e77e02c90aeec82cfa0ceb91804cbb9a9f4fba666c8d9bc1ac19c` |
| `capture-preflight.ts` — unchanged tests | `80932c305f4b374135d0a001a1924934f13778f72f151adf4089d902726f1b8a` |
| `qualify.ts` | `7d91ff89c79b492a672f8d22ca9e1983eea573a7d24bf89888338c18f34725ec` |
| `continuation.ts` | `767ad98f62a595c7f449c4c572574c944d17747a7a69290f2810fe1361a9be6a` |
| `evidence-terminal.ts` | `7fad6673fdcabd4455d9758460ae532314ad12f40985062d1d23939db3596dc3` |
| `startup.ts` | `32f6bfd7cd150000b54cfbed9fbd39b902bbe74c08da26df74a354f897534c54` |
| `startup-only.ts` | `75b32720af0f259d6f4401d5d10ea70f17e42e6c94cfeaa2aedeb6dcf46f0d9b` |
| `tooling-checks.ts` | `ad7e74f749acf5d7e0f0b81f3df9aa0dbb194d08c3cd544167ab160d33d8b9b7` |
| `final-audit.ts` | `4ae498121aa77f34815a86863305c7351ff36474480e7d7ba1268e04e051e9c8` |

Passing preflight SHA-256: `adf4d175a20985ce4759c3076118e9ccd50f15c626e7df7bca34816a234b8ce7`. Source-binding SHA-256: `be44af2d616b816204a6876c2cc166b415ac73a6f14dfe57d70b09308c3e4393`.

The [new final terminal audit](final-terminal-audit.json) verifies terminal/observed-exit consistency and inventory hashes, 52 historical public artifacts, six custody/configuration/permit files, all 72 original source files, BUILD_ID and 233 original build files; it checks the protected client/server bundle boundary, public artifact hygiene using both private IPs in memory, and absence of listeners on 3037/3038. Because the actual gate failed, this audit makes no new database connection; fresh database facts above come from actual cleanup. [Final checks](checks.json) record exact observed syntax/documentation/audit exits and artifact fingerprints. Both documentation commands also passed at the actual attempt's end.

Capture semantics remain a fully buffered, fixed-target loopback normal HTTP reverse observation proxy, with exact upstream entity/header preservation, decoded compressed scanning, browser cache disabled and service workers blocked. Buffering changes streaming, timing and hop framing. Native-cache behavior, unintercepted transport and hosted egress are not qualified. Arbitrary duplicate headers and br/deflate support are implementation capabilities, not separately exercised synthetic acceptance cases.

F1/F2 are ready for reviewer recheck. The full TASK-019 gate remains failed at the unresolved browser lifecycle drain; this exhausted scope provides no authority to alter the proxy, rerun the gate or claim the missing four-case matrix.
