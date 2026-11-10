# TASK-005 durable paid-resource slice

Work ref: `orca:run_3bfef6dba661/payment`, local main based on `180a88d`; no checkout, stash restoration, commit or push. Scope includes preserved predecessor source selectively reviewed against current DB/domain APIs. Canonical task state remains coordinator-owned.

## Implemented

- `apps/server/src/index.ts` and `worker/{payment,live-adapter,queue,runtime,ingress,continuity}.ts`: executable Node consumer, bounded authenticated wake ingress, SQL queue/agent leases, ownership fences, fresh policy/deployment checks, verified registration plus complete DB nonce history, exact-envelope encryption/recovery, durable Velo identity before exclusive dispatch and observation-only recovery afterward. SDK transport retries are disabled; unknown retains budget and withholds entitlement.
- `src/server/http/application.ts`, `http/wake.ts`, `merchant/{receipts,reports}.ts`: authenticated immutable 402 challenge, ID-only quote acceptance, safe attempt polling, derived owner/run/resource/window-bound receipt, gated fictional report delivery and future-offer merchant edits. No public proof ingestion or success-flag authority.
- `src/server/domain/{purchases,evidence}.ts`: lease-fenced refusal and atomic verified evidence/entitlement/budget commit, retaining existing SQL financial guards. Authorization and merchant claim remain separate.
- `src/server/integrations/wallet-inspection.ts`, domain wallet import and spike-runtime re-export: move pure wallet body/auth inspection out of the filesystem journal dependency graph; preserve existing spike behavior. Web still has no agent signer/Velo/model/encryption secrets.
- `scripts/purchase-{setup,smoke}.ts` and root `purchase:smoke`: explicit disposable Testnet setup, actual read-only preflight and deliberately affordable 300000-stroop CLI purchase through the application Request/Response boundary plus real SQL/SDK executor. Append-only CLI checkpoints retain the original run/quote/acceptance identity. No report body, receipt token, XDR or credential enters exported proof.
- `tests/integration/{payment-recovery,purchase-http}.test.ts` and `support/payment-adapter.ts`: actual PostgreSQL locks/state constraints with explicitly synthetic provider transport for duplicates/crashes/late proof/lease loss/HTTP ownership/receipt/resource/price/wake boundaries. Synthetic tests cannot create live proof artifacts.

The exact implemented API/read-model and model-worker integration contract is [api-contract.md](api-contract.md).

## Observed gates (2026-11-09)

Commands use installed pinned Node/pnpm/dependencies, without install or peer overrides. `COREPACK_ENABLE_NETWORK=0` was set. Where root scripts invoke `pnpm` recursively, `.fmd-work/pnpm-bin` contains task-local Corepack shims and was prepended to PATH; no global package-manager mutation.

| Actual command | Exit | Observed result |
| --- | --- | --- |
| `corepack pnpm exec vitest run tests/integration/payment-recovery.test.ts tests/integration/purchase-http.test.ts` | 0 | Initial targeted 17/17, 2 files, 28.01 s; followed by full current suite below |
| `corepack pnpm test:integration` | 0 | Current 64/64, 6 files, 39.30 s; actual PostgreSQL 17.11 in existing isolated integration DB with per-invocation UUID schemas and independent pools; synthetic chain/provider transport |
| `corepack pnpm test:unit` | 0 | 73/73, 4 files, 1.24 s |
| `corepack pnpm test:spike` | 0 | 50/50, 0 skipped, 3.439 s; explicitly offline/synthetic regressions |
| `corepack pnpm exec tsc --noEmit` | 0 | Current strict root source/tests/scripts check |
| `corepack pnpm --filter @aegispay/web typecheck` | 0 | Existing Next consumer compiles with backend changes |
| `corepack pnpm typecheck` with task-local Corepack shim on PATH | 0 | Complete root script, including recursive web typecheck |
| `corepack pnpm lint` | 0 | Current scripts/src/tests/apps/packages ESLint gate |
| `python tools/check-docs.py` | 0 | 21 canonical Markdown files, IDs/links/coverage checks; documentation check only |
| `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` | 0 | 14 task rows and coherent state/dependency DAG; documentation check only |
| `corepack pnpm purchase:smoke --setup` with explicit `RUN_TESTNET=1` | 0 | Actual separate device registration, finite policy and capped escrow funding; no paid authorization |
| `corepack pnpm purchase:smoke --preflight` | 0 | Actual current configured tuple/network/SAC/device/policy/escrow/DB nonce read-only checks; no purchase |

Earlier root typecheck invocations exposed concurrent E2E source errors, fixed by their owner; a direct root script initially failed because `pnpm` was absent from recursive PATH, then passed using the isolated shim. No frontend build was run concurrently with UI work. Historical predecessor logs in this directory are preserved; the table identifies this worker's latest observed gates.

## Actual Testnet setup and execution record

Setup artifact: [actual-testnet-fixture-setup-no-purchase-1794216467460.json](actual-testnet-fixture-setup-no-purchase-1794216467460.json). Read-only preflight: [actual-read-only-purchase-preflight-1794216580451.json](actual-read-only-purchase-preflight-1794216580451.json).

Separate device: `790905edd7c6d36e300d0149ed6d73ef60db6bcc6635c50fa2b7312dc7bbeb7c`. DB agent: `e901976a-7ef3-4784-b510-bc1632935d35`. Actual setup registration/policy/funding ledgers: `5638546` / `5638551` / `5638558`. Policy maximum: `1000000` stroops; expiry: `2026-11-09T10:25:52Z`; funded escrow: `10000000` stroops. The previous `.aegispay-spike` historical payment/claim is unchanged, and no DB nonce/history/volume was reset.

A coordinator serialization pause interrupted the first `--execute` during read-only verification. Both exact process IDs `33344`/`28272` were confirmed absent afterward; DB reconciliation twice found zero runs/attempts, last nonce `0`, no reservation/handoff, and no CLI purchase checkpoints. The predecessor was then confirmed closed/settled with no active financial process. Coordinator explicitly authorized this sole writer to resume one guarded purchase on the same fixture; no new fixture or reset was used.

Initial `corepack pnpm purchase:smoke --execute` exited **1**, `PAID_RESOURCE_GATE_UNRESOLVED`, after its bounded 90-second execution/observation window. Its real accepted quote is `2919ccca-2d31-4bc4-9140-649c8b1fc0ae`, attempt `f69178b7-0b0b-46fa-8e82-65c2dd5deee5`, operation `3ced1846-a7cd-4455-bb27-0b21a253f2c3`, nonce `1`, Velo reservation `3ef113f6-0bb4-449a-ac6a-29407adb4ee5`, inner hash `36f71d7ddee16271b6c23e73fa5ef1f1ca4f0e44e3d0a52ef6eca2115f80d0f8`. Persisted handoff: `2026-11-09T09:36:16.026075Z`, before quote expiry `2026-11-09T09:37:52.027Z`. Velo observed `claimed`; outer hash was null. DB status remained unknown with reserved `300000`, spent `0`, zero entitlements. See [actual-testnet-unresolved-checkpoint.json](actual-testnet-unresolved-checkpoint.json).

The exact CLI checkpoint was resumed for identity-only observation on November 10. Its real paid-resource gate remains nonzero, as recorded below. Unknown retains the exact identity and held budget; it is never replaced by another quote/sign/submit.

## November 10 resumption and gate result

**TASK-005 acceptance remains unfinished.** The actual bounded CLI `--observe` exited **1**, `PAID_RESOURCE_GATE_UNRESOLVED`. No current paid report or entitlement was delivered, and no new signature, sponsorship, financial handoff, fixture, nonce or quote was created in this resumption. No canonical task/document state, frontend, lockfile, hosting, submitted site or PDF was changed by this executor.

Initial OS inspection found no active Node process whose command line matched the payment worker or purchase CLI. Docker Desktop's Linux engine was stopped, so Docker Desktop was started with a hidden launch; existing restart policies resumed the existing application DB. No volume/container/history was removed or reset, and no command targeted `dost_db`. The application and integration DBs reuse their preserved configuration; integration tests use only newly owned UUID schemas.

Actual observations, both exit 0 for diagnostic collection only:

- [Before recovery](actual-identity-only-observation-1794288823393.json), `2026-11-10T05:33:43.391Z`.
- [After the failed paid-resource recovery gate](actual-identity-only-observation-1794289316928.json), `2026-11-10T05:41:56.924Z`.

Both confirm the original identity above, exactly **one** agent attempt, `last_nonce=1`, ciphertext absent, no active agent lease, **reserved 300000 / spent 0 / entitlements 0**. Velo identity-only status returned HTTP **409**; independent RPC lookup of the original inner hash returned **NOT_FOUND**; current escrow was **10000000** and merchant pending **0** stroops. These observations do not establish terminal non-success, and the expired original policy never cancels its dispatched payment. Held budget and lack of entitlement remain correct.

The installed published Velo **1.0.0** `dist/gas.js` implements `getStatus` as `POST /api/gas/submit` with only `{requestId,transactionHash}`, `submission:false` and `maxRetries:0`. Its README says `claimed`, `submission_unknown`, `submitted` remain running. `dist/errors.js` maps HTTP 409 to `VeloValidationError`; the package does not establish a successful/terminal outcome from that conflict. Public npm/source browsing was unavailable (403/unavailable), so this conclusion is limited to the actual installed pinned package and current observed response, not an invented server-side explanation.

External blocker sent to the coordinator: **Velo project/operator-side reconciliation of reservation `3ef113f6-0bb4-449a-ac6a-29407adb4ee5` and inner hash `36f71d7ddee16271b6c23e73fa5ef1f1ca4f0e44e3d0a52ef6eca2115f80d0f8`, including its verified execution status and outer hash if executed.** No new financial dispatch is authorized while this original handoff remains unresolved. There is no missing credential claim: the current blocker is unavailable authoritative provider recovery, not an invitation to change identity.

Changes in this resumption:

- Added `scripts/purchase-observe.ts`, a signer-free identity-only DB/Velo/RPC diagnostic with allowlisted artifact fields.
- Added `observationOnly` in the executor and explicit CLI `--observe`. Recovery requires complete original checkpoints and a saved handoff, does not issue/accept a new quote, and independently forbids prepare/sponsor/submit while retaining the actual verifier/atomic grant path.
- Added two real-PostgreSQL integration regressions with synthetic provider transport: conflict after quote/policy expiry remains held under the same identity; explicit observation-only recovery can grant only verified matching success and refuses all financial methods.
- Replaced subsecond timing assumptions in expiry/late-confirmation tests with five-second setup windows and waits against the DB clock. Removed the duplicate root `purchase:smoke` script key; no dependency pins changed.

### Observed November 10 commands

Pinned installed tools; `COREPACK_ENABLE_NETWORK=0`. The full root typecheck uses the existing task-local Corepack shim on PATH for its recursive `pnpm` invocation. No frontend build was run.

| Actual command | Exit | Observed result |
| --- | --- | --- |
| `node --env-file-if-exists=.env.worker.local --import tsx scripts/purchase-observe.ts` (before and after recovery) | 0 / 0 | Actual read-only original-identity diagnostics above; payment still unknown |
| `corepack pnpm purchase:smoke --observe` with explicit `RUN_TESTNET=1` | **1** | **Actual Testnet paid-resource gate unresolved**, original attempt only; observation-only adapter guards enabled |
| `corepack pnpm exec vitest run tests/integration` before additions | 0 | Existing 64/64 in 6 files, 56.61 s; actual PostgreSQL, synthetic provider |
| Expanded integration run under concurrent validation load | 1 | 63/66; one pool acquisition timeout and two subsecond timely-handoff fixture races; DB correctly refused late handoff; no live records involved |
| `corepack pnpm exec vitest run tests/integration` after DB-clock wait repairs, without parallel unit/spike/build work | 0 | **66/66**, 6 files, 111.15 s; actual PostgreSQL 17 with independent pools and UUID schemas; synthetic provider transport |
| `corepack pnpm test:unit` | 0 | 73/73, 4 files, 7.66 s |
| `corepack pnpm test:spike` | 0 | 50/50, zero skipped, 23.513 s; offline/synthetic only |
| `corepack pnpm typecheck` | 0 | Root strict source/test/scripts plus web typecheck |
| `corepack pnpm exec tsc --noEmit` after timing-test edits | 0 | Final root strict source/test/scripts |
| `corepack pnpm lint` | 0 | Source/scripts/tests/workspaces gate |
| `python tools/check-docs.py` | 0 | 21 canonical Markdown files; documentation only |
| `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` | 0 | 16 valid task rows, coherent DAG; documentation only |

The nonzero real gate prevents a done claim despite passing offline/DB gates. These observations do not satisfy two distinct live purchases, actual model purchase, fresh merchant claim, browser/hosted journey, deployment/cold-host recovery, or TASK-006's broader crash/expiry/failure matrix. The API/read-model and safe worker entrypoints are reconciled in [api-contract.md](api-contract.md). No independent-review acceptance is claimed; no reviewer findings had been delivered to this worker at this evidence checkpoint, and the coordinator owns that review and canonical task state.

## Remaining acceptance outside this slice

TASK-006 expands process-kill/lease-expiry/queue/restart/cold-host tests, definitive included-failure reconciliation and broader refusal/expiry/resource windows. Current conservative provider-only failure remains unknown/held until independent matching evidence or explicit audited resolution; no automatic refund/repurchase exists. Full run/model tooling/events belong to TASK-007; full authenticated UI/browser/wallet rehearsal and hosting remain later gates. No fresh merchant claim, two-distinct-purchase release acceptance, expired-policy live refusal, full E2E/build or hosted journey is established by these backend gates.
