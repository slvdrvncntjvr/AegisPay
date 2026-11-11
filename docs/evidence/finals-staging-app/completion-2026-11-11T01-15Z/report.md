# TASK-019 matched response completion repair

The focused regression and source-bound Chromium preflight passed. The new actual staging gate exited 1 during `database-tls-verification`, before recording TLS, clock, login-budget, HTTP or browser results. TASK-019 remains unfinished. The coordinator acknowledged the prerequisite escalation and is investigating the exact database connection and client access rule.

Work ref is Orca task `task_35cf627dcc9a`, dispatch `ctx_b7e5bf88bb7d`, from committed checkpoint `4dc3889`. This report preserves the failed execution as observed. The coordinator owns further execution authorization and task acceptance.

## Completion evidence change

Every delivered browser response now retains the specific captured upstream object selected during response matching. The record includes original status, captured/scanned body completion, cancellation state and observed proxy response finish. `ServerResponse` finish and `writableFinished` provide the send-completion evidence. A closed response with `writableFinished` false records cancellation.

After the existing quiet interval, a missing browser terminal event can be reconciled only when all of these conditions hold.

- The browser reported delivery of that response.
- Its upstream match is unique and retained directly on the browser response record.
- Original and browser status match.
- The exact upstream body has been captured and scanned.
- The proxy has finished sending the response.
- Browser and proxy cancellation flags are both false.
- Capture work and pending proxy responses have drained.

Reconciliation sets `completedByProxyFinish`, while the browser-event fields retain their observed values. The public summary reports separate counts for CDP finish/failure, redirect responses, corroborated client-socket cancellations and matched proxy finish. Pending entries contain method, numeric status, path category and a fixed reason such as `AWAITING_PROXY_RESPONSE_FINISH`, `DELIVERED_STATUS_MISMATCH` or `AMBIGUOUS_UPSTREAM_MATCH`.

Existing body/status failures, cancellation checks and exact per-context request maps remain acceptance requirements. No timeout increased. Request forwarding, response status/headers/body delivery, redirect/retry behavior and cookie handling follow the existing observation proxy. The qualifier also records a fixed browser-case phase and requires zero pending proxy responses. Its safe exception categories now recognize the capture drain errors directly.

## Focused regression and preflight

The focused regression uses a real owned loopback HTTP fixture and proxy with controlled browser lifecycle input. It holds the upstream response and verifies that drain remains pending, then supplies `responseReceived` while omitting both CDP terminal events. After the actual response finishes, drain succeeds with one matched-proxy-finish completion and zero CDP terminal completions. A mismatched delivered status is rejected. These receipts contain synthetic fixture data. [Final focused regression](completion-check-2.json)

Two regression executions returned exit 0. The second adds assertions for the separate completion-evidence counters. The existing Chromium preflight then returned exit 0 using the final source binding. Its unchanged tests covered gzip/binary delivery and scanning, request fidelity, cookies/204, redirects, cancellation, fast navigation, multiple contexts and post-disposal body ownership.

The preflight recorded 21 browser requests, 21 proxy requests and 21 fixture upstream requests. Both contexts completed with exact request maps, zero missing delivered bodies, zero pending browser/proxy responses and zero failures. Native browser events completed delivered responses in this preflight. The controlled focused regression exercises the omitted-terminal-event path. [Chromium receipt](preflight-1.json)

| Command | Exit | Evidence |
| --- | --- | --- |
| `node --import tsx deployment/finals/staging-app/capture-completion-check.ts`, execution 1 | 0 | `completion-check.json` |
| Same focused command, execution 2 | 0 | `completion-check-2.json` |
| `node --import tsx deployment/finals/staging-app/capture-preflight.ts` | 0 | `preflight-1.json` |
| `node --import tsx deployment/finals/staging-app/qualify.ts --resume` | 1 | `actual/result.json` |

## Actual staging blocker

The actual command ran from 2026-11-11T01:22:38.518Z through 01:22:45.726Z. It failed at `database-tls-verification` with the fixed top-level category `QUALIFICATION_ASSERTION_OR_DEPENDENCY_FAILED`. The receipt contains no allowlisted connection code or SQLSTATE and does not establish the underlying cause. Current helper TLS, database time and natural login budget were not observed. [Actual result](actual/result.json)

No application process, HTTP request, browser case or login was reached. There were no new test sessions, migration/seed calls, configuration/secret creation, rebuild, worker/model/financial/wallet/chain action, provider access-rule change, deployment or source publication. Original configuration fingerprints passed their reached checks and cleanup confirmed the staging configuration file unchanged. The helper store closed after the failed attempt.

Fresh session/financial table counts were unavailable in this attempt. The previous gate's ten revoked sessions and empty financial/execution tables remain historical observations. The code paths reached here perform connection verification and configuration reads, and reached no table mutation.

The coordinator received escalation `msg_dd79daa3ae05`. Its response `msg_84258f29017d` directed continued offline evidence/cleanup work while it diagnoses the connection and narrow client access rule. This scope made one actual attempt and preserved its receipt. A concrete continuation remains pending.

## Terminal evidence and audit

F1 terminal evidence remains enforced. Result, inventory and exclusive finalization hashes are bound to the external runner's observed exit 1. `readTerminal` accepts their consistency and returns `passed: false`. The new supported audit consumer requires these artifacts and verifies inventory file hashes before accepting the execution record.

| Artifact | SHA-256 |
| --- | --- |
| Actual result | `9ca42ef6f72de120229d03af43ef86c1b7285ba6d173dd9880f29604bb9a6858` |
| Actual inventory | `ae2c5a79331e33bd103adab579bb2e10eec6848eecb93805b9d593d2f557da35` |
| Finalization | `9dea4465c13ddcd09801b7b1e2ac5f10ea5c86ed85537c45bf9f9c713001dd7c` |
| Observed exit | `15e9eeecd1af82b1ab9e7cdff0929983250b9f17ef251e20f2e54c797e370ff0` |
| Source binding | `fb5c8e9d3d55d0177fa2ed94bc094fcb9b2a7eb4ebddc65da4ebc6ccebc903d8` |
| Passing preflight | `d16653a4e6bc1d02aec46ea9f1ba0488a3b3f908837709c4d158dffeeed8148e` |

F2 startup diagnostics remain in the shared production launcher. This attempt stopped before startup. The new audit therefore runs offline preservation and hygiene checks and skips an independent database reconnect. [Final audit](final-terminal-audit.json)

The preserved baseline contains 113 historical public artifacts/helpers and six protected custody/configuration/permit files. The audit verifies original 72-file application source, BUILD_ID and 233 build-file fingerprints, client/server protected-finding boundaries, public artifact hygiene and unused loopback ports 3037/3038. Both original and rotated client IPs are included in memory-only scans. The complete fingerprints and exact documentation/syntax exits are recorded in the new evidence. [Checks](checks.json)

## Bound helper sources

The source binding lists all ten helper paths and hashes. The changed production helpers are below, with paths under `deployment/finals/staging-app/`.

| File | SHA-256 |
| --- | --- |
| `proxy-capture.ts` | `d1fbf66b6b8bdb0c56a0e5d16e606f1adbcc334a8efc3b7e978132658bdddfa9` |
| `qualify.ts` | `e3dea1f8ab09025c80d68912378df42d1c2cbd28e8cd05ed38994f529d5bd04e` |
| `continuation.ts` | `ab2821831071aa3102f681c5790ca5aa6650e52e2c8eee79a27e3873e511accf` |
| `capture-completion-check.ts` | `a31f8d9c0d033f7b2ac13ad94bbbbe76ab76099f30a12a7f7a78a6f0cb10ee25` |

The preflight, terminal publication module, startup diagnostics and audit source files retain their prior source contents. The new authorization and execution records link the previous exhausted marker and receipts. Bound source files remained stable after the refreshed preflight. [Full source binding](continuation-source-binding.json)

The capture method remains fully buffered loopback reverse observation proxying with browser cache disabled and service workers blocked. Buffering affects timing, streaming and hop framing. Hosted egress and native-cache qualification remain open. The real four-case matrix and fresh same-state database/session/financial checks require the coordinator's forthcoming continuation after the prerequisite diagnosis.
