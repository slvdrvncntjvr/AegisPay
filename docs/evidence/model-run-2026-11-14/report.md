# First app task failed before financial acceptance

Actual saved run `3c80396e-2575-4f9a-8e1f-76321c5c9542` stopped at model turn1 with MODEL_UNAVAILABLE. Tool steps0, reserved0,spent0; quotes0,payment attempts0,entitlements0. Its job is done. The failed run remains intact and is not reset or restarted. No escrow spend or merchant credit occurred. [Actual authenticated readback](actual-readback.json).

A bounded fictional task through the same configured `gemini-3.5-flash` adapter subsequently passed:2discovery GET200 and1generation POST200, with parsed discover_offers proposal. No proposed tool was executed. [Provider receipt](probe-configured.json). There was no model/key/provider switch. The original app run did not save its HTTP status; MODEL_UNAVAILABLE can mean discovery absence,404 or5xx, so its precise underlying response is unknown. A later successful probe does not retroactively prove the original status or make the failed app task successful.

## Repair and checks

The transport now retries an explicit503 once, with500ms backoff, inside the same original30-second deadline and caller cancellation. Discovery/generation responses are data/proposals; the retry does not execute any accepted tool, restart a durable terminal run, or repeat a payment handoff. Other status/network failures retain existing behavior. [Google's troubleshooting guidance](https://ai.google.dev/gemini-api/docs/generate-content/api-errors) identifies503 as service unavailability; this supports the narrow recovery choice, not an attribution for the unrecorded original HTTP response. Raw provider error bodies remain unlogged/unexposed.

The screenshot also exposed stale parent run state: detail polling showed failed while the selector still showed queued and blocked composing. Run observation now reconciles its matching list entry with detail, while retaining other active-run holds. Detail statuses must match the declared run states. No financial authority changes.

- Focused model boundary55/55 and full unit122/122 pass;4new cases cover503→success, repeated503 bounded failure, cancellation during backoff and shared original deadline. The first deadline test exposed that native timers/promises were outside fake timers; using an explicitly cancellable global timer makes the same timing boundary deterministic. The original failed test output remains a test-development observation, not live provider evidence.
- Types/lint/production build pass,exit0. Final UI status validation is included in the final successful production build.
- Production authenticated console21/21 browser cases pass, including stale queued→failed reconciliation and preservation of a separate pending run. Protected transport in that suite is synthetic.
- [Actual browser/API/SQL check](actual-readback.json) passes6checks without submitting a task; its test session is revoked. [Real failed-run screenshot](failed-run-preserved.png). The composer was filled only to check its enabled state; Start task was never clicked by the coordinator.
- Exact old web/worker PID, command, executable and creation timestamps were checked before stopping them. [Rebuilt web startup](web-restarted.json) returns200. [Worker resume](worker-resumed.json) rechecks actual setup, cap/escrow1000000stroops, nonce0, one exact failed untouched model run, no financial records, and completed jobs before runtime-only Testnet execution. Persistent private RUN_TESTNET remains0. No new task/quote/handoff was created.

## Next manual intent and remaining gates

Hard-refresh http://127.0.0.1:3019/app, paste the same QuickSignal-only task and click Start task once. This is a fresh manual intent after an observed terminal failure before any quote/payment; it is not a replacement for an unknown financial operation. Current QuickSignal price300000stroops, normal run/escrow ceiling1000000stroops; policy expiry2026-11-14T15:48:20Z (23:48:20 Manila). A saved unknown financial outcome must instead remain held and be observed by identity.

TASK-030 completes bounded provider transport and terminal UI recovery. Actual app model/purchase/refusal/recovery and merchant claim/revoke/reclaim/hosted/media release remain incomplete. Original unrelated unknown incident remains untouched. No full MVP or live purchase success is claimed.
