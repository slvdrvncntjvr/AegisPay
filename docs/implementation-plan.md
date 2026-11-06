# Implementation plan — AegisPay

**Plan steward:** the active coding agent, supervised by Vincent. One executor; no agent crew is configured.
**Last checkpoint:** 2026-11-07, TASK-001 claimed on local Git main baseline 5d51ffa.
**Deadline / demo cutoff:** event deadline unknown. [assumption] Plan for roughly 16–24 focused hours over two days after prerequisites; keep the final quarter for verification and rehearsal. No fabricated calendar cutoff.
**Current stopping point:** reviewed execution docs and dependency research only; no runnable MVP or live payment evidence.

## 1. Planning inputs

- **Current code state:** greenfield; only IDEA.md, FMD and this documentation package. Workspace was not a Git repository at inspection. No package install, app, migration, testnet wallet operation or deployment is claimed.
- **Team capacity:** one active coding agent/implementer handles TypeScript, SQL, SDK integration and UI serially. Vincent holds external wallet/provider-account access. Do not invent named teammates or spawn a crew from this plan.
- **Core journey:** UJ-002 with UJ-001 setup, UJ-003 refusal, UJ-004 recovery and UJ-005 claim. Product definitions: [PRD](prd.md).
- **Highest risks:** Velo accepts the same prepared Noir transaction; mandatory contract deployment; event/hash decoding; durable crash boundary; model account access.
- **Required quality commands:** `python tools/check-docs.py` and `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` now. Future code commands: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build`, opt-in `pnpm test:testnet`. See [QA](qa-test-plan.md).
- **Browser E2E:** `pnpm test:e2e`, primarily TC-015/TC-025/TC-028 plus one real wallet/model rehearsal. Browser mocks are not live evidence.
- **Hard constraints / rubric:** [context](../context.md); [PRD invariants](prd.md). Official rubric/format/eligibility is unverified; do not allocate invented weights.
- **Delivery convention:** local-first until a repository/remote exists. On implementation kickoff, create local Git tracking if absent; then use a task branch from local `main`. No GitHub account, repository, PR requirement, project or remote mutation is inferred. If an existing checkout is supplied later, inspect its actual default branch. A local commit/diff is an acceptable work ref for this solo demo.

### Execution priorities and time control

TASK-001 is a minimal SDK/script harness, not a dashboard scaffold. TASK-002 is the first hard gate before UI. Timebox initial integration investigation to about two focused hours after working credentials; if it fails, retain exact evidence and fix the narrow blocker. Do not spend the remaining time on UI that implies an unproved integration. If Gas cannot support the same invocation, record a scope decision; a separate checkout is never an automatic fallback.

After TASK-005 there is a CLI paid-resource slice, after TASK-007 a genuine agent purchase, and after TASK-010 the complete evidenced demo. A CLI slice is honest progress but does not satisfy all P0 acceptance. Under time pressure cut optional deployment, motion, generalized merchant tooling and benchmarks before correctness or P0 outcomes. An actual P0 cut must be logged and the reduced claim disclosed.

## 2. Task ledger

Statuses are `ready`, `in_progress`, `blocked`, `done`, `cut`. Here blocked downstream tasks mean their listed dependency is unfinished, not that the documentation task failed. All app gates below are planned commands, not observed passes. Implement required scripts before invoking them. The intentionally serial DAG suits one executor and avoids shared-file races.

| ID | Outcome / trace | Depends on | Owner | Write scope | Work ref | Status | Gate / evidence |
|----|-----------------|------------|-------|-------------|----------|--------|-----------------|
| TASK-001 | Minimal pinned runtime/package and SDK import harness; infra, F-012; TC-026 | — | Implementer | package.json, pnpm-lock.yaml, tsconfig.json, eslint.config.mjs, .node-version, scripts/sdk-imports.ts, scripts/verify-contracts.ts, .env.example, compose.yaml | task/TASK-001-sdk-harness | done | `npx --yes pnpm@12.18.0 verify:sdk-imports` + `npx --yes pnpm@12.18.0 typecheck` + `npx --yes pnpm@12.18.0 lint`: result: PASS, exit 0; frozen install exit 0; build approval repaired initial install exit 1; docs/run-evidence.jsonl |
| TASK-002 | Same signed Noir invocation sponsored/submitted via Velo, virtual device, live policy refusal and merchant claim; F-001, F-002, F-003, F-006, F-007, F-011; TC-001, TC-002, TC-013, TC-016, TC-022 | TASK-001 | Implementer | scripts/spike-noir-velo.ts, src/server/integrations/noir.ts, src/server/integrations/velo.ts, src/server/integrations/stellar-evidence.ts, tests/testnet/, docs/evidence/testnet/ | — | ready | `pnpm verify:contracts` + `pnpm spike:noir-velo`: pending; TASK-001 passed; no live evidence |
| TASK-003 | Durable quote, budget, nonce, attempt and evidence constraints validated against Postgres; F-004, F-006, F-008, F-009; INV-001, INV-003, INV-010; TC-007, TC-018, TC-023, TC-031 | TASK-002 | Implementer | src/server/db/, src/server/domain/, scripts/seed-demo.ts, tests/unit/, tests/integration/, drizzle.config.ts, package.json, pnpm-lock.yaml | — | blocked | `pnpm test:unit` and `pnpm test:integration`; no results observed |
| TASK-004 | Authenticated API and Freighter owner setup/funding/policy path; F-001, F-002, F-003; TC-020, TC-022, TC-024 | TASK-003 | Implementer | src/server/auth/, src/app/api/session/, src/app/api/v1/wallet-operations/, src/app/login/, src/app/components/WalletControls.tsx, tests/integration/auth.test.ts, tests/integration/http-boundaries.test.ts | — | blocked | `pnpm test:integration` and `pnpm typecheck`; live wallet lifecycle evidence also required; not run |
| TASK-005 | CLI purchases real protected endpoint through durable payment worker and gates report by receipt; F-004, F-006, F-007, F-008, F-009; TC-001, TC-006, TC-011, TC-030 | TASK-004 | Implementer | src/worker/, src/server/merchant/, src/server/integrations/, src/server/domain/, src/app/api/, scripts/purchase-smoke.ts, tests/integration/, package.json | — | blocked | `pnpm purchase:smoke` and `pnpm test:integration`; no results observed |
| TASK-006 | Unknown/crash/expiry/duplicate behavior proven without redispatch; F-007, F-008, F-009; INV-005, INV-010; TC-007, TC-012, TC-017, TC-019, TC-029 | TASK-005 | Implementer | src/worker/, src/server/domain/, src/server/integrations/, tests/integration/recovery.test.ts, tests/integration/crash-boundaries.test.ts, tests/integration/expiry.test.ts, tests/integration/replay.test.ts | — | blocked | `pnpm test:integration`; include independent-connection races and crash injection; not run |
| TASK-007 | Real bounded model discovers/chooses/prices/purchases and resumes saved operation; F-005; INV-007; TC-014, TC-021, TC-023 | TASK-006 | Implementer | src/server/agent/, src/server/integrations/model.ts, src/worker/, src/app/api/v1/runs/, scripts/demo-smoke.ts, tests/unit/purchase-guard.test.ts, tests/integration/budget.test.ts | — | blocked | `pnpm demo:smoke` and `pnpm test:unit`; real current-price tool trace required; not run |
| TASK-008 | One console shows policy/run/merchant/audit with honest state and gated fixtures; F-010, F-009; TC-015, TC-025, TC-028 | TASK-007 | Implementer | src/app/, src/server/domain/read-model.ts, tests/e2e/, playwright.config.ts, package.json, pnpm-lock.yaml | — | blocked | `pnpm test:e2e` and `pnpm build`; no results observed |
| TASK-009 | Merchant price changes and wallet claim; owner revoke/reclaim surfaced and rechecked; F-003, F-004, F-011; INV-001, INV-009; TC-016, TC-022, TC-031 | TASK-008 | Implementer | src/app/components/, src/app/api/v1/merchant/, src/app/api/v1/wallet-operations/, src/server/domain/claims.ts, tests/testnet/claim.test.ts, tests/testnet/lifecycle.test.ts, tests/integration/quotes.test.ts | — | blocked | `pnpm test:testnet` and `pnpm test:integration`; separate claim/reclaim evidence required; not run |
| TASK-010 | Reproducible complete demo, fresh evidence and no secret/content leaks; F-012; TC-001, TC-002, TC-015, TC-021, TC-025, TC-026, TC-028 | TASK-009 | Implementer | README.md, .env.example, docs/onboarding.md, docs/pitch-kit.md, docs/evidence/testnet/, scripts/demo-smoke.ts, tests/, package.json | — | blocked | `pnpm typecheck` + `pnpm lint` + `pnpm test:unit` + `pnpm test:integration` + `pnpm test:e2e` + `pnpm build` + `pnpm test:testnet` + `pnpm demo:smoke`; all app gates unrun |

## 3. Checkpoint transaction and branch/review protocol

Claim the earliest ready task, record branch or equivalent local work ref, change to `in_progress`, then execute its gate. Stay within declared scope; the same executor may update related canonical docs and task evidence when needed. At each task completion, blocker, changed assumption or session end:

1. Inspect actual files, branch/diff, command output and evidence. A written test plan is not a passing test.
2. Update the task row's status and factual evidence; a completed local gate plus reconciled work ref permits `done` under the current plan/checker. Do not use older FMD `in_review` status. `done` is not a claim that a remote PR was merged. Reset false completion if contradicted.
3. Set a dependent `ready` only when all its dependencies are done; otherwise leave it blocked. Add newly discovered tasks with new IDs, never renumber/delete old ones. Log significant scope changes in the ledger; routine state changes stay here.
4. Append a fact-only event to `docs/run-evidence.jsonl` using the bundled recorder or task helper once a build run starts. Record command/result/artifact, not invented timing or causal judgments. Inspect `--help` for exact checked-in helper flags. The helper is optional for this local solo plan; factual row/evidence updates remain required.
5. Run both documentation/plan checks. Update owned product/architecture/test facts only when intended behavior changes. Do not regenerate the whole suite when implementing the existing spec.

If GitHub is later configured, task branches/PRs carry task ID, affected feature/invariant IDs, docs impact and exact verification. Resolve semantic conflicts from both intents and canonical docs, rerun the smallest affected gates; after three failed repair attempts record the blocker. Never blanket use `ours`/`theirs` for semantic conflicts.

## 4. GitHub delivery projection

**Run ID:** `RUN-20261107-aegispay-docs` identifies the preparation session only; no live build run is activated.
**GitHub delivery mode:** `not configured`.

Repository, project owner/number, remote/default branch and activation digest are absent. No Issues, Projects, PRs or Actions are created. A future explicit delivery setup may enable the kit's preview/SHA-bound projection; until then local Markdown remains the sole task authority. Missing GitHub setup never blocks local implementation.

## 5. Run evidence and derived view

No application run events are fabricated. `docs/run-evidence.jsonl` will be created by the first actual build checkpoint. Current ready task is TASK-001; TASK-002 through TASK-010 await dependencies. The checker derives ten serial waves from this DAG. A local bootstrap import gate may proceed without provider keys; missing keys block the live spike and are recorded with exact missing variable names, never values.

## 6. Plan change log

| Timestamp / event | Tasks changed | Why / evidence | Canonical docs reconciled |
|-------------------|---------------|----------------|---------------------------|
| 2026-11-07 · preparation | TASK-001 through TASK-010 created | Greenfield workspace and public package research; no app execution | PRD, architecture, data, API, methods, security, QA |
