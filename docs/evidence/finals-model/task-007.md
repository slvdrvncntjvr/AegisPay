# TASK-007 scoped implementation evidence

Work ref: Orca task `task_17440a74ef85`, dispatch `ctx_33127b548a11`, baseline `6765edbe76405a5398d25c7098ebabb678e87b37`. This worker does not change canonical task scheduling, stage/commit/push, deploy, access the actual application database or run financial/provider/chain operations. The coordinator owns final TASK-007 status and promotion.

## Implementation

`runConsumer` leases **only** `run` jobs with the existing `claimJob(store,['run'])`; `paymentConsumer` retains its existing reconciliation ownership and SQL/financial guards. Worker startup, authenticated wake and shutdown wire both consumers. Queue acceptance is distinct from execution and completion.

Each tool action runs under a current, locked SQL job lease plus the existing agent/run ownership lock order. The application Request/Response interface uses a short-lived worker session scoped to the original owner/run, revoked in the same transaction. A transaction-scoped Store makes quote issuance, payment acceptance, operation identity, tool response and private checkpoint commit together. No model tool imports an SDK signer, makes outbound HTTP, calls a wallet gateway or receives session/receipt tokens, credentials or envelopes. The consumer cannot execute a payment; the existing reconcile job does that independently.

Current public offers are read from the catalog. Quotes come from the actual fixed protected demo route with the declared `demo-parser` dependency and run ID, require HTTP402 plus the matching quote header, and are compared to the trusted SQL quote. Duplicate requests reuse the immutable original quote; current offer edits do not change accepted terms. One persisted purchase mapping binds quote/client-idempotency/attempt/operation identity. Subsequent calls and restarts observe that original attempt, including `unknown`/`manual_review`; they never create an alternate quote or handoff. Reports reach the model only through the existing owner/run/receipt entitlement gate. Final citations use the delivered server receipt ID.

The loop has durable eight-turn/twelve-tool bounds and a 90000ms active model allowance. It reserves a turn and up to30000ms before provider work, charges observed monotonic time on success, and retains the conservative full reservation after a crash/error. Payment waiting consumes neither additional model turns nor repeated tool steps. Abort and a separate promise deadline bound even a transport that ignores cancellation; late provider completion cannot execute tools or persist a stale decision. Lease loss prevents checkpoint, event, terminal and job-completion writes. Timeout/model failure preserves unresolved held funds and the payment consumer's original operation.

Private provider continuation parts, opaque signatures and gated report responses remain only in `agent_run.tool_checkpoint`, capped at512KiB. They are excluded from run/state/event responses. Complete call batches are validated before executing a prefix, with strict shared tool intents and no authoritative model amount, URL, policy or success flag.

## API007 and UI integration

The coordinator explicitly expanded scope to `src/server/http/application.ts` and new `tests/integration/run-events.test.ts` for the missing events route. Existing purchase/wallet route behavior and protected ingress remain unchanged. The route enforces owning session or exactly matching worker run, merchant403, foreign owner/run404; positive int64 decimal cursor, ascending100-row maximum, decimal IDs and cursor, ISO dates, `no-store`. Unknown/invalid event payloads are skipped while the raw row cursor advances to avoid reconnect loops.

`src/server/agent/events.ts` is the exact typed contract. Kinds: `run_started`, `model_turn`, `tool_selected`, `quote_received`, `payment_accepted`, `payment_observed`, `resource_delivered`, `run_completed`, `run_stopped`. Quote events carry trusted immutable quote metadata; acceptance adds original attempt/operation IDs. Projection strips all unlisted stored JSON fields and emits no model prose, tool arguments/results, private report, thought, token, private checkpoint or raw provider error. The UI worker received this schema and source-stability notice and remains sole Next build/server owner.

## Official API inspection

Retrieved and inspected the current official [GenerateContent reference](https://ai.google.dev/api/generate-content) and [function-calling guide](https://ai.google.dev/gemini-api/docs/function-calling), with URL/content hashes in `primary-sources.json`. The GenerateContent reference confirms `parametersJsonSchema`, function call/response identity and opaque `thoughtSignature` continuation plus `includeThoughts`. Retained the existing pinned Node REST adapter and configured model selection. No package/lockfile/dependency changes or invented SDK methods.

## Observed gates and remaining work

Early targeted core gate:20/20. Expanded targeted model unit/PostgreSQL model/events gate:39/39, exit0 (`targeted.txt`). Explicit offline smoke:90/90, exit0 (`offline-smoke.txt`), comprising existing model-adapter tests plus the new model/event tests; all provider/chain transport is explicitly synthetic and database writes are confined to invocation-owned guarded localhost `/aegispay_integration` schemas. Financial/provider keys are removed from test environments; the smoke child inherits only an OS/test-DB allowlist. Default smoke exits1 (`default-smoke.txt`), performs no financial action, and names missing explicit mode/live same-invocation/independent evidence/real model-purchase gates.

Observed root `node node_modules/typescript/bin/tsc --noEmit` and scoped ESLint both exit0 (`root-typecheck.txt`, `scoped-lint.txt`). Documentation and strict implementation-plan checks pass. An initial events test setup intentionally attempted an invalid cross-owner worker-session binding and was rejected by the existing SQL scope trigger; corrected the fixture to a same-owner, different run before the passing39-case gate. No application guard was weakened.

Full sequential integration, full unit/spike/lint, the optional single nonfinancial model-only probe and final fingerprints are recorded in the closing addendum after their actual runs. Recovery worker was given the first full PostgreSQL slot; this worker paused integration/smoke while that gate ran. No Next build/server was launched by this worker.

This is scoped implementation/offline evidence, never live purchasing acceptance. Original TASK-005 attempt `f69178b7-0b0b-46fa-8e82-65c2dd5deee5` remains unknown, held and unentitled; no actual application query or mutation was performed here. Final release still requires actual model purchasing, successful same-invocation Noir/Velo execution, independently matching chain evidence, genuine wallet/recovery/browser/hosted gates and coordinator approval. Synthetic receipts and model-only stub choices do not satisfy those gates.
