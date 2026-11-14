# Wallet setup recovery — 2026-11-14

The local app at http://127.0.0.1:3019/app now uses the actual owner address supplied by the user: `GAXQOA4O5YZHOXJP2TFDOA6RFKL3UXVUH3XGFEL3GMGBM3V32FRENZS7`. Freighter had a different account selected from the earlier configured historical owner; the app's signer check correctly prevented signature/submission. User confirmation and the new connection diagnostic established this mismatch. No private key was requested or exported.

## Recovery and usability

The saved registration `4b494ed6-f71b-4f90-bcfe-b1aa480420a4` was prepared, with no handoff marker or transaction hash. Its time bound elapsed. An actual authenticated status check marked it expired using database time; no signature, submission or chain failure was inferred. [Saved-status receipt](saved-registration-check.json). Unknown/submitted operations retain identity-only observation and never expire merely because time passes.

Wallet history is expanded and exposes **Check wallet status** directly. A pending operation has a nearby status action. Expired unsigned review material clears automatically, while confirmed server refreshes replace stale local unknown labels. The UI explains registration → confirmed finite policy → funding. **Check Freighter connection** distinguishes missing/locked access, wrong account and wrong network; signing distinguishes rejection, returned signer mismatch, and expiry. Only fixed messages and a bounded numeric extension code may appear; arbitrary extension messages, signed material and private payloads stay out of UI/logs. Detection/read requests are bounded; signatures arriving after preparation expiry are discarded. The server still independently checks the exact body/source/network/signature.

The actual public owner correction ran only after verifying an empty chain device/policy/escrow, zero nonce/policy, no run/quote/payment/evidence/entitlement/job/claim history, and exactly the expired unhanded preparation. Agent identity, nonce, device and old immutable preparation were preserved. Only the new setup's owner metadata/configuration changed. The accepted historical context proposal remains unchanged; `context-current.json` explicitly supersedes its owner selection. [Selection receipt](owner-selection.json). No original incident or preview data changed.

After controlled local restart, actual owner login/state matched GAXQ…NZS7 and the existing new agent/device, unprovisioned state and1000000-stroop funding ceiling. The old actor's unsigned record returns404 under the new wallet identity. The check session was revoked. [Actual access receipt](selected-owner-access.json). Login tokens remain unchanged in ignored, protected `.fmd-work/release-setup/access.md`. The user also supplied distinct merchant `GAD7HS6DXSAZG7LQRXJWGK322LORGCI2BZP5S3TQ75ATWLJQKKRTXCHK`. A guarded metadata/config correction before any run/quote/payment/claim preserved owner wallet operations and agent nonce. One exclusive-marker-protected Friendbot request activated that new merchant Testnet source account; independent Horizon identity readback passed. No pending credit, claim or escrow deposit was fabricated. [Merchant selection](merchant-selection.json). After a safe restart with only elapsed unhanded preparations, [actual role access](current-roles-access.json) matched both user-supplied addresses and revoked its two test sessions. Keep Freighter on owner GAXQ…NZS7 for registration; switch to merchant only for a later separate claim.

## Validation

| Gate | Actual result |
|---|---|
| Types/lint/build | exit0; [types](types.txt), [lint](lint.txt), [build](build.txt) |
| Unit |118/118; six new connection/signing/privacy/timeout cases; [receipt](unit.txt) |
| PostgreSQL |152/152, isolated actual PostgreSQL with synthetic chain transport; [receipt](integration.txt) |
| Focused wallet/worker |32/32; unsigned expiry versus unknown handoff and single-identity behavior; [receipt](targeted-postgres.txt) |
| Production authenticated-console browser |19/19, synthetic protected transport; [final receipt](browser-accepted.txt) |

The first type check rejected an optional wallet address; a missing-address guard repaired it. The first expanded browser run passed18/19 because its new test expected raw `confirmed` instead of the actual `Confirmed on chain` label; the exact visible-label assertion was corrected and all19 passed. Earlier receipts remain preserved. A PowerShell stop command encountered an automatic JSON-date conversion error in its timestamp check; exact saved PID/executable/command checks still selected only the owned web/worker. Replacement processes and the subsequent owner-selection restart were correctly verified with typed timestamps and exact commands. No unrelated process was stopped. No independent post-quota agent acceptance is claimed; coordinator owns these checks.

## Next human action and release limits

Hard-refresh the local page, check Freighter connection with GAXQ…NZS7 on Testnet, then prepare **Register device** and explicitly approve its signature. Status can update from the worker/console refresh; use **Check wallet status** if needed. Set policy/fund only after registration confirms. The lifetime escrow funding maximum remains1000000stroops (0.1TestnetXLM), without replenishment after spend/reclaim. Purchase dispatch remains disabled while setup is incomplete.

TASK-026 completes engineering/recovery, not human wallet lifecycle or full live release. No current registration, policy, deposit, app purchase or merchant claim is claimed by this report. The new hosted database prerequisite is tracked in [its separate report](../hosted-release-2026-11-14/report.md).

Final [documentation](docs-final.txt), [strict27-task plan](plan-final.txt), [hygiene](hygiene.json) and source checks pass. Known-value/pattern scanning covered51changed files,13current clientJS files and14private values in memory, with zero matches; custody remains ignored. This is a bounded local check, not a complete hosted response/leak gate. No third-party post-repair review is claimed.
