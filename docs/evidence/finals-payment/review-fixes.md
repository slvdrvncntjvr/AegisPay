# TASK-005 review fixes — 2026-11-10

Review-fix deliverable for Orca Task `task_ebef123ec7c2`, dispatch `ctx_2ada0a31a5b9`; equivalent work ref `orca:run_3bfef6dba661/payment`. This follows the [independent review](../finals-review/task-005-review.md). The original failed TASK-005 gate/history is preserved. **These code fixes do not complete TASK-005 or its real paid-resource gate.** Canonical task state remains coordinator-owned.

## Fixed behavior and verification

| Review finding | Implementation | Actual PostgreSQL verification |
| --- | --- | --- |
| R1 / high: wallet reads re-enable a suspended agent | Shared `observedPolicyStatus` builds an atomic SQL CASE evaluated against the current update-locked agent row. Both HTTP wallet refresh and human-wallet confirmation retain `disabled`, while refreshing observed policy fields. No browser/operator re-enable endpoint was added. | Four cases cover preexisting disable and a disable committed by a second connection during the awaited policy RPC, separately for refresh and confirmation. Each asserts the policy cache updates but status stays disabled and both new run creation and quote acceptance fail `POLICY_NOT_READY`. Existing unknown recovery is additionally tested after disabling its agent: original identity verifies/grants without a new sign/sponsor/submit, while the agent remains disabled. All transport/chain responses in these tests are synthetic. |
| R2 / medium: contradictions look transient | An explicit allowlist of internal `SpikeGuardError`/`DomainError` identity, invocation, signature, history and evidence-binding failures becomes lease-fenced `manual_review` with fixed `PAYMENT_EVIDENCE_CONTRADICTION`. Raw SDK messages/objects never become reasons. Missing chain/event data, a temporarily absent provider outer hash and transport failures remain unknown. | Persisted outer-hash contradiction, verifier invocation mismatch and final evidence-context mismatch all retain original nonce/reservation/inner/outer/handoff, reserved 300000/spent 0 and no entitlement. Missing proof stays unknown; a null provider outer hash preserves the known saved hash rather than becoming a contradiction or overwriting identity. A second connection replacing the worker lease before a contradiction prevents the stale worker from saving its decision or releasing that replacement lease. Existing provider-409-after-expiry test still passes. |
| R3 / medium: awaited ownership read crosses the first-dispatch deadline | After the durable marker, the final ownership SELECT FOR SHARE samples DB time. The final conservative time adds the entire monotonic read duration, including pool/lock/network delay; lease and quote checks then run synchronously immediately before invoking submit, with no intervening application await. Expiry after marker saves `manual_review` / `POST_HANDOFF_QUOTE_EXPIRED`, keeps the handoff and budget, and prevents subsequent automatic dispatch/grant. | A second PostgreSQL connection holds the agent row lock until DB time crosses quote expiry while the lease remains valid. The executor's final read blocks, then records the anomaly with **zero submit/status calls**, one original sign/reservation, retained ciphertext deletion/identity/held budget and no entitlement, including after retry. The separate valid timely-submit/late-confirmation case still authorizes the original terms. |
| Low-priority owner-state minimization | Owner state selects exactly 12 public/read-model agent fields rather than serializing the entire SQL row. Lease owner/deadline, owner FK, nonce bookkeeping and creation metadata are omitted. | Authenticated owner response asserts the exact field set and absence of a lease sentinel. Root/web typecheck also passes with this shape. |

R3 controls the application's first invocation of the financial SDK method. It cannot guarantee when a remote provider dispatches/includes a timely submitted transaction. Normal late confirmation is still accepted only after both evidence sources independently match. A saved post-marker expiry anomaly needs operator review; no new repair, cancellation, release or proof-ingest HTTP route exists.

## Source and contract scope

Changed source: `apps/server/src/worker/payment.ts`, `src/server/domain/wallet.ts`, `src/server/http/application.ts`.

Changed tests: `tests/integration/payment-recovery.test.ts`, `tests/integration/wallet.test.ts`, `tests/integration/http-boundaries.test.ts`. These tests use real PostgreSQL locks/independent connections and explicitly synthetic SDK/chain transport; they never write live proof.

The [API contract](api-contract.md) records the explicit owner agent shape, preserved suspension behavior, safe manual-review reasons and conservative post-marker expiry behavior. [Final source fingerprints](review-fix-source-fingerprints-final.json) identify the exact repaired files for independent reviewer recheck; the earlier in-progress manifest is preserved. No dependency, lockfile, frontend, deck, deployment, canonical document, branch, commit or push change was made by this follow-up.

## Observed gates

Installed pinned tools only; `COREPACK_ENABLE_NETWORK=0`. PostgreSQL suites were run sequentially (`fileParallelism:false`); full static/regression checks followed. The root typecheck used the existing task-local Corepack shim on PATH for its recursive package-manager call. No worker startup/queue consumption or frontend build was run.

| Exact command | Exit | Actual result |
| --- | --- | --- |
| `corepack pnpm exec vitest run tests/integration/wallet.test.ts tests/integration/payment-recovery.test.ts tests/integration/http-boundaries.test.ts` | 0 | 35/35, 3 files, 36.84 s |
| `corepack pnpm test:integration` (initial repaired scope) | 0 | 78/78, 6 files, 76.50 s; actual PostgreSQL in invocation-owned UUID schemas |
| `corepack pnpm exec vitest run tests/integration/payment-recovery.test.ts` after distinguishing null outer hash from contradiction | 0 | 25/25, 1 file, 31.87 s |
| `corepack pnpm test:integration` (final source) | 0 | **79/79**, 6 files, 65.51 s; actual PostgreSQL in invocation-owned UUID schemas |
| `corepack pnpm typecheck` | 0 | Root strict source/tests/scripts and recursive web typecheck |
| `corepack pnpm lint` | 0 | Full current source/scripts/tests/workspaces |
| `corepack pnpm test:unit` | 0 | 73/73, 4 files, final rerun 2.58 s |
| `corepack pnpm test:spike` | 0 | 50/50, zero skipped, final rerun 5.876 s; offline/synthetic only |
| `python tools/check-docs.py` | 0 | 21 canonical Markdown files; documentation gate only |
| `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` | 0 | 16 valid task rows and coherent dependency/state DAG; documentation gate only |
| `git diff --check -- apps/server/src/worker/payment.ts src/server/domain/wallet.ts src/server/http/application.ts tests/integration/payment-recovery.test.ts tests/integration/wallet.test.ts tests/integration/http-boundaries.test.ts` | 0 | No tracked whitespace errors |

All repair gates passed on their first invocation. The full 79-case suite includes the final contradiction-allowlist/history-gap handling and null-versus-conflicting-hash distinction; root/web typecheck, lint, unit and spike checks were rerun afterward and passed. Process-kill/cold-host recovery, broader TASK-006 failure/expiry cases and complete release acceptance remain separate work; exception hooks still execute catch/finally and are not OS process-death evidence.

## One bounded original-identity status detail

After initial repair gates, the coordinator explicitly authorized exactly one SDK status call to retain safe stable error metadata. A single-use inline module was piped to `node --env-file-if-exists=.env.worker.local --import tsx --input-type=module`, exit **0** for diagnostic collection only. Its only service call was `await createVelo(process.env).gas.getStatus(identity)`, using the original reservation/inner hash from the prior public checkpoint, with explicit equality checks against those original IDs. No signer, sponsor, submit, RPC/chain read, DB mutation, queue consumer or internal provider action ran.

Actual artifact: [actual-single-status-detail-1794290430016.json](actual-single-status-detail-1794290430016.json), observed `2026-11-10T06:00:30.015Z`:

- Original reservation: `3ef113f6-0bb4-449a-ac6a-29407adb4ee5`; original inner hash: `36f71d7ddee16271b6c23e73fa5ef1f1ca4f0e44e3d0a52ef6eca2115f80d0f8`.
- SDK name: `VeloValidationError`; HTTP **409**; stable allowlisted code: **`reservation_expired`**.
- Safe error/correlation request ID: `4db7ad55-5519-4e79-9442-a366474099cd`. This is error metadata, **not a replacement reservation or operation identity**.
- Exactly one status call, zero new financial dispatch/application mutation. Only allowlisted codes/class names, validated request-ID formats and safe identity fields were exported; no raw exception/body, credential, XDR or report content was printed.

This narrows the [unsent operator request](../finals-provider/operator-request.md) using the coordinator's [source diagnosis](../finals-provider/diagnosis.md). Public source deployment compatibility remains unverified. The no-XDR status branch may update provider unsent-expiry bookkeeping; `reservation_expired` alone still does **not** establish definitive nonexecution or safely release the application reservation. No further provider polling was performed.

The original application attempt `f69178b7-0b0b-46fa-8e82-65c2dd5deee5`, operation `3ced1846-a7cd-4455-bb27-0b21a253f2c3`, quote `2919ccca-2d31-4bc4-9140-649c8b1fc0ae`, nonce `1` remain the recovery identity. The last actual application checkpoint remains unknown, held 300000/spent 0/no entitlement; this follow-up made no fresh application/chain state claim or mutation. **TASK-005 live acceptance remains blocked on authoritative provider reconciliation plus matching independent chain verification, not solved by the repaired code or status error.**
