# Independent TASK-019 repair recheck — 2026-11-11

**Scoped acceptance: original P2 F1 and F2 are addressed in the inspected helpers and supported terminal consumer; the matched proxy-finish alternative is acceptable within the declared buffered loopback capture design. No new severity finding was established. Actual resumed gate acceptance remains pending.** This report does not mark TASK-019 done or establish hosted, native-cache, live-payment or complete MVP acceptance. The original review remains historical and unchanged.

Work ref: task `task_f01c79b81ad6`, dispatch `ctx_dc036c1b3aff`; local HEAD observed as `4dc3889a1d2ff913f1bfcd0f34d3b08d17d27268`. This is a static/public-evidence review only. No helper/application, DB, browser, network, provider or financial execution occurred; no private configuration, custody or IP permit was read; no Git mutation or helper worker was used. Writes are exclusively new `recheck2-*` files in this review directory. Original `report.md`, fingerprints, scripts and partial `recheck-*` artifacts were preserved.

## F1: accepted for the new protocol and consumer

`deployment/finals/staging-app/evidence-terminal.ts:11` prepares serialized result, inventory and finalization, validates all three before publication, then exclusively writes inventory, provisional result and terminal finalization in that order. Finalization binds the two artifact hashes, outcome and expected exit. A result explicitly requires terminal finalization and externally observed exit. `readTerminal` at line 35 requires the four files, their hash/outcome/exit agreement and the inventory's result entry. Missing finalization or observed exit and exit mismatch reject acceptance. `qualify.ts:562` catches publication failure and leaves the run failed; a provisional passed result alone is insufficient.

`final-audit.ts:55` uses that consumer and line 59 additionally checks the terminal inventory's file hashes. Its own audit outcome may be passed while the actual gate is failed; the separate actual outcome/exit fields retain that distinction. Historical consumers and old result-only receipts are not retroactively upgraded.

The inspected `finalization-2026-11-10T15-16Z/offline-check-2.json` records seven synthetic protocol cases, including faults after result publication and a modeled observed-exit mismatch. Only the fault-free fixture passes. Those modeled exits are not actual application-process evidence. Independent Python comparisons in this review verify that both historical actual four-artifact sets bind consistently to **failed / observed exit 1**, rather than trusting the report prose.

## F2: accepted diagnostic repair

`startup.ts:12` classifies `SPAWN_ERROR`, `NATURAL_EXIT`, `READY` and `READINESS_TIMEOUT`. The launcher records allowlisted spawn errors, child exit/signal state, TCP probes/counts, elapsed time and safe log categories/hash. `snapshot()` at line 28 retains pre-cleanup facts; `qualify.ts:524` saves a snapshot before owned cleanup. Cleanup separately records its kill/exit result. The existing 40 probes, 500 ms socket timeout and 250 ms unsuccessful-probe interval remain bounded.

The synthetic taxonomy receipt exercises all four classifications. The actual startup-only receipt establishes READY in 531 ms / three probes, null pre-cleanup exit/signal, no spawn error, zero proxy requests and zero app-pool TLS observations; owned cleanup confirms exit. The later historical full run establishes READY in 533 ms, remains alive before cleanup, and separately records one strict TLS1.3 application-pool observation. This resolves the missing diagnostic distinction prospectively; it does not explain the earlier unclassified failure's cause. READY itself is TCP readiness, with HTTP/TLS established separately.

## Matched completion: accepted with explicit evidence limits

The inspected `proxy-capture.ts:81` awaits the upstream entity's `end`, rejects aborted/error/oversized bodies, scans the exact raw entity plus supported decoded compressed representation, and only then marks it captured (line 99). It forwards that same entity and original status/status phrase/raw headers at line 102. No retry, replacement GET, redirect follower or cookie jar is introduced.

`delivered()` at line 124 retains the captured upstream object selected by the existing method plus full path/query matching, marks the object used, retains whether the candidate was unique, and faults missing bodies or changed status. The new fallback does not search again for a different response after matching. `pendingCategory()` at line 139 requires delivery, the retained captured body, matching status, a unique match, no browser/proxy cancellation and successful proxy response finish before returning the only category eligible for fallback.

`ServerResponse` finish/close observation at lines 69–74 requires `writableFinished`; a close before that records cancellation. `drain()` at line 178 additionally requires no pending capture work, no pending proxy responses and the existing quiet interval before setting `completedByProxyFinish`. A missing delivered body/status mismatch creates a persistent failure; missing delivery, ambiguous match, cancellation without its separate permitted evidence or an unfinished proxy response cannot enter this alternative. A genuinely pending upstream stream remains pending and eventually hits the unchanged drain bound. The existing separately evidenced canceled-prefetch path is retained; it is not counted as uncanceled proxy completion.

`qualify.ts:473` requires exact per-context request count maps, zero capture failures, zero missing delivered captures and zero pending capture/browser/proxy work. Line 528 additionally requires every actual upstream body captured and each proxy response finished or canceled. The four-case and minimum 41 HTTP checks remain present at lines 485 and 502. Completion repair does not weaken those gates.

Missing native CDP events are reported honestly: `finished` and `terminalEvidence` remain untouched by the fallback. Summary lines 200–220 separate native finish/failure, redirect response, corroborated socket cancellation and matched proxy finish. The focused synthetic receipt records zero CDP terminal events and one matched-proxy-finish completion. This proves the specific alternative with controlled lifecycle input; it is not a native Chromium terminal event or proof that Chromium consumed every byte.

The focused regression source checks a real held upstream response stays pending for its 250 ms observation, then accepts the exact scanned delivered entity after actual proxy finish, and rejects a delivered-status mismatch. Its second receipt is passed. The unchanged Chromium preflight records 21 browser = 21 proxy = 21 fixture requests, complete 12/12 and 9/9 contexts, exact maps, zero missing delivered captures/failures/pending work, and **zero** matched-proxy-finish completions. Thus that preflight exercises ordinary browser/cancellation paths; only the controlled regression exercises omitted terminal events. Missing-body, ambiguous-match and canceled-delivery rejection under the new alternative are inspected guards, not additional dynamically executed negative tests in this review. No reviewer application tests were run.

The correlation remains the existing method/path/query and one-to-one captured-object discipline; no new independent browser-body digest is asserted. Full buffering changes streaming, timing and hop framing. Browser cache is disabled and service workers blocked. Arbitrary identical-URL concurrency, unintercepted transport, native caching and hosted egress are outside this scoped acceptance.

## Actual evidence and pending join

The historical finalization actual receipt independently binds to failed / exit 1, 37 expected HTTP checks, 16 scanned assets, one strict app-pool TLS1.3 observation and zero completed browser cases. Cleanup records 10/10 sessions revoked, zero unrevoked sessions, all eleven enumerated financial/execution tables zero, original staging-config fingerprint unchanged, owned proxy closed and owned Next exited by SIGTERM. Its real-browser lifecycle failure is preserved; none of those partial results is promoted to a completed matrix.

The completion actual receipt independently binds to failed / exit 1 at `database-tls-verification`, with zero HTTP/browser/app-pool TLS evidence and no fresh session/financial counts. Earlier cleanup counts stay historical. The coordinator's later client-rule/TLS/clock prerequisite repair is supplied context; this reviewer did not read permits or reverify that service.

At the single final directory observation **2026-11-11T04:26:23.095105Z**, `completion-resume-2026-11-11T01-27Z` contained authorization/binding/execution/precheck/prerequisite/bookkeeping artifacts but no actual result, inventory, finalization or observed-exit receipt. **Actual resumed acceptance is pending, not failed by inference and not accepted.** No polling or wait loop followed. The coordinator must join the eventual four consistent terminal artifacts with all four owner/merchant desktop/mobile flows, actual app TLS, complete HTTP/asset/leak evidence, cleanup/owned-process exit, fresh revoked-session counts and financial-zero checks. Later writer output is outside this evidence snapshot.

## Exact source binding and observed drift

Initial source reads were stable at 2026-11-11T04:24:40.724951Z. Paths below are under `deployment/finals/staging-app/`.

| Source | Inspected SHA-256 |
| --- | --- |
| `proxy-capture.ts` | `d1fbf66b6b8bdb0c56a0e5d16e606f1adbcc334a8efc3b7e978132658bdddfa9` |
| `capture-completion-check.ts` | `a31f8d9c0d033f7b2ac13ad94bbbbe76ab76099f30a12a7f7a78a6f0cb10ee25` |
| `evidence-terminal.ts` | `7fad6673fdcabd4455d9758460ae532314ad12f40985062d1d23939db3596dc3` |
| `startup.ts` | `32f6bfd7cd150000b54cfbed9fbd39b902bbe74c08da26df74a354f897534c54` |
| `final-audit.ts` | `a11692c5c825aae4c856b52980d4ac145a94a75a770304e26a3fc628893285ae` |
| `qualify.ts`, initial | `09a5fa6911c05f8d5e856cd7f57f46b03c720bc15e62e10284dddd77960a0b6f` |
| `qualify.ts`, authorization-only drift | `32455a87b9aa7c121b3594f946e0a94928ba083456efcd87ff9a32e5ef74d686` |
| `continuation.ts` | `28d2be66074df2a27824935220398e0e867de9c449fc1e4456b3609f18a0a356` |

The current capture preflight source fingerprint remains `80932c305f4b374135d0a001a1924934f13778f72f151adf4089d902726f1b8a`, matching its completion receipt binding. Terminal/startup/completion-regression/proxy sources match that historical completion binding. Qualifier, continuation namespace and final-audit differences are documented in the resume bookkeeping patch: immutable preflight reuse verifies unchanged capture/test sources, updated current source binding and patch hash; current IP hygiene adds another permit to memory-only scans. No private permit contents were inspected.

During review, qualifier changed again only from dispatch literal `ctx_b7e5bf88bb7d` to `ctx_95b52e773108` at line 209. Reversing that single literal reproduces the exact initial qualifier hash. The stable read at 04:27:12.319127Z matches the new authorization, source binding and execution marker. The other six source snapshot entries did not drift. The earlier bookkeeping JSON/patch describes the preceding qualifier hash; its historical mismatch is recorded, not silently rewritten or presented as the latest binding.

`recheck2-fingerprints-2026-11-11.json` records initial before/after source hashes. `recheck2-evidence-2026-11-11.json` records receipt fingerprints, independent terminal comparisons, safe evidence facts and the bounded final directory observation. `recheck2-drift-2026-11-11.json` records authorization-only drift proof and binding/marker fingerprints. The original report remains SHA-256 `0161e39980d84b22c24a3acde1d5f8febcf4abb8412253bd458c8886b2249a88`. Reviewer Python readers perform file/hash/JSON comparisons only; their successful execution is static evidence, not an application gate.

Known-secret, protected-fixture and private-IP absence are not independently compared against private values in this review. Sanitized prior author scans support only their recorded executions. No full source/build preservation rerun or listener/DB observation is claimed here. Remaining live model/payment/recovery, original held/unentitled incident resolution and release obligations remain unchanged.

Reviewer documentation checks both exited 0: `python tools/check-docs.py` and `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict`. They report structural documentation/DAG validity only. Exact commands and observed exits are recorded in `recheck2-checks-2026-11-11.json`.
