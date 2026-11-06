# QA test plan

**Status:** executable test specification; application tests do not exist yet and have not passed. Documentation checks are recorded separately in [document review](document-review.md).

## Strategy and environments

Use pure Vitest unit tests for parsing/guards; PostgreSQL integration tests for locks, state transitions and uniqueness; Playwright Chromium for visible journey and secret/fixture leakage; separate opt-in real Testnet tests. Never use SQLite to prove PostgreSQL races. Run concurrency cases on independent DB connections. Real funding/submission tests use capped disposable Testnet keys/wallets and configured Velo Gas access.

Required package scripts are implementation targets for TASK-001:

```text
pnpm typecheck             strict TypeScript, no emit
pnpm verify:sdk-imports    tsx scripts/sdk-imports.ts (package exports/runtime only)
pnpm lint                  configured current ESLint command, not obsolete next lint
pnpm test:unit             vitest run tests/unit
pnpm test:integration      vitest run tests/integration (isolated PostgreSQL DB)
pnpm test:e2e              playwright test tests/e2e (local web + worker + test DB)
pnpm test:testnet          vitest run tests/testnet (explicit RUN_TESTNET=1 guard)
pnpm build                next build
pnpm verify:contracts     tsx scripts/verify-contracts.ts
pnpm spike:noir-velo       tsx scripts/spike-noir-velo.ts
pnpm demo:smoke            tsx scripts/demo-smoke.ts
```

Testnet scripts refuse mainnet and missing configured IDs; missing credentials are reported as not run, never a passing mock. `test:testnet` must fail its acceptance run if a required live case skips. Build scripts refuse to print environment values. Mock fixtures have obvious synthetic transaction IDs and never enter a live evidence file.

## Test cases and feature/invariant traceability

Each row's file is the required test location; its command runs that group. Legacy T01–T20 from IDEA.md map to TC-001–TC-020. No unsupported webhook feature is added to exercise the negative cases.

| TC-ID | Feature / invariant | Setup / action | Required result | Exact command and planned file |
|-------|---------------------|----------------|-----------------|--------------------------------|
| TC-001 | F-006, F-007, F-008; INV-002, INV-004 | Real affordable purchase on verified contracts | Velo succeeded + matching independent Noir invocation/event, exact delta, one entitlement | `pnpm test:testnet` · tests/testnet/purchase.test.ts |
| TC-002 | F-003, F-006; INV-008 | Local above-cap purchase plus isolated actual contract refusal | No fulfillment; distinguish local denial, live simulation error and any included failure evidence | `pnpm test:testnet` · tests/testnet/policy.test.ts |
| TC-003 | F-003; INV-008 | Policy expires before authorization | Actual deployed contract refuses; no entitlement | `pnpm test:testnet` · tests/testnet/policy.test.ts |
| TC-004 | F-002, F-006; INV-005 | Empty device escrow | Preflight/live refusal, no protected response | `pnpm test:testnet` · tests/testnet/policy.test.ts |
| TC-005 | F-003, F-006; INV-007, INV-008 | Quote/invocation wrong asset | Guard rejects; isolated live contract fixture rejects nonpolicy asset | `pnpm test:testnet` · tests/testnet/policy.test.ts |
| TC-006 | F-006, F-008; INV-001, INV-002 | Alter merchant, nonce, source, amount, contract or extra auth call | No sponsor dispatch; forged matching event alone insufficient | `pnpm test:integration` · tests/integration/intent.test.ts |
| TC-007 | F-009; INV-003, INV-010 | 50 concurrent acceptance/grant/read requests | One attempt, reservation, evidence and entitlement; same-purchase reads permitted within window | `pnpm test:integration` · tests/integration/replay.test.ts |
| TC-008 | F-009; INV-006 | Copy receipt to different quote/resource of same price | Denied; original receipt retains its resource only | `pnpm test:integration` · tests/integration/replay.test.ts |
| TC-009 | F-008; INV-009 | POST fake Velo checkout webhook to guessed route | 404; no domain mutation or entitlement | `pnpm test:integration` · tests/integration/untrusted-proof.test.ts |
| TC-010 | F-008; INV-002 | Fake Noir webhook/foreign event | No webhook route; unrelated event cannot pass RPC evidence verifier | `pnpm test:integration` · tests/integration/untrusted-proof.test.ts |
| TC-011 | F-008; INV-004, INV-005 | Pending, reservation-only, Velo-only or chain-only observations | No entitlement until both successful and consistent | `pnpm test:integration` · tests/integration/evidence.test.ts |
| TC-012 | F-007, F-008; INV-005, INV-010 | Timeout/disconnect after handoff; restart worker | Same saved identity is observed; never submit or sign again | `pnpm test:integration` · tests/integration/recovery.test.ts |
| TC-013 | F-001, F-006, F-012; INV-002 | SDK default or configured contracts/network/SAC mismatch | Stop before signing/sponsor; saved verified deployment evidence required | `pnpm verify:contracts` · scripts/verify-contracts.ts |
| TC-014 | F-005, F-006; INV-007 | Report/task injects arbitrary URL, new merchant, cap edit or huge spend | Narrow schemas/guard reject; model cannot reach owner operations | `pnpm test:unit` · tests/unit/purchase-guard.test.ts |
| TC-015 | F-010, F-012; INV-007 | Sentinel secrets through errors/logs/build/client traces | No secrets or signed agent XDR exposed | `pnpm test:e2e` · tests/e2e/redaction.spec.ts |
| TC-016 | F-011; INV-009, INV-010 | Claim real pending balance, then repeat safely | Real merchant claim and matching ledger result; no duplicate payout/entitlement | `pnpm test:testnet` · tests/testnet/claim.test.ts |
| TC-017 | F-007; INV-004, INV-005 | Sponsor disabled, cap/quota/auth denial | Safe error, no direct Noir bypass, no entitlement | `pnpm test:integration` · tests/integration/recovery.test.ts |
| TC-018 | F-002, F-004, F-010; INV-007 | Exact units, negative/zero/excess precision/overflow cases | 0.03 → 300000 exactly; validated provenance/unknown semantics | `pnpm test:unit` · tests/unit/amounts.test.ts |
| TC-019 | F-004, F-008; INV-001, INV-005 | Quote expires before handoff; timely handoff confirms late | Stale new spend refused; valid late success gets original entitlement/window; unresolved payment retained | `pnpm test:integration` · tests/integration/expiry.test.ts |
| TC-020 | F-001, F-009; INV-006 | Unauthenticated, wrong role, wrong owner or stolen token | No cross-owner read/write/report; deny before quote creation | `pnpm test:integration` · tests/integration/auth.test.ts |
| TC-021 | F-005 | Real model run; swap offer prices within bounds and include unnecessary-data task | Recorded tool calls use current inputs, sensible option/no-purchase; no always-buy script | `pnpm demo:smoke` · scripts/demo-smoke.ts |
| TC-022 | F-001, F-002, F-003 | Freighter setup, funding, revoke then reclaim | Actual policy/balances/owner match; no funded-device unlink; wrong wallet/network denied | `pnpm test:testnet` · tests/testnet/lifecycle.test.ts |
| TC-023 | F-005, F-006; INV-007, INV-010 | Concurrent quotes and unknown reservations exceed remaining budget | Atomic budget constraint holds; duplicate accept doesn't reserve twice; unknown keeps funds reserved | `pnpm test:integration` · tests/integration/budget.test.ts |
| TC-024 | F-001, F-012 | Malformed/oversize/forged-Origin requests, login floods, wallet-body substitution | 400/413/403/429; signed operation bound to source/body; no mutation | `pnpm test:integration` · tests/integration/http-boundaries.test.ts |
| TC-025 | F-010 | Poll/reload console across pending, unknown, refused, authorized and claimed | Honest labels, separate claim state, persistent IDs and no duplicate jobs | `pnpm test:e2e` · tests/e2e/console.spec.ts |
| TC-026 | F-012 | Clean DB install/migrate/seed, second seed, cold web+worker startup | Reproducible setup, idempotent seed, no fake funded/paid state | `pnpm demo:smoke` · scripts/demo-smoke.ts |
| TC-027 | F-007, F-010 | Fee null/mismatch, clocks, sample durations | Methods/provenance exact, unknown stays unavailable; percentiles suppressed when undersampled | `pnpm test:unit` · tests/unit/methods.test.ts |
| TC-028 | F-004, F-008, F-009; INV-005, INV-006 | Search unauthorized responses, HTML/RSC, JS and errors for fixture sentinel | No protected content outside authorized read | `pnpm test:e2e` · tests/e2e/fixture-leak.spec.ts |
| TC-029 | F-006, F-007; INV-010 | Crash before reserve, after reserve, before send marker, after marker, after submit and before grant; nonce collisions | Defined recovery only; preserved nonce/hash; pre-send uncertain stall safe; grant exactly once | `pnpm test:integration` · tests/integration/crash-boundaries.test.ts |
| TC-030 | F-009; INV-003, INV-006 | Lost response token, repeat metadata retrieval, expiry | Owner can recover same receipt without repaying; original window unchanged; expired read denied | `pnpm test:integration` · tests/integration/receipt.test.ts |
| TC-031 | F-004, F-005; INV-001 | Change resource price after quote acceptance | Old quote immutable; new catalog/quote uses new price | `pnpm test:integration` · tests/integration/quotes.test.ts |

All F-001 through F-012 have tests. All INV-001 through INV-010 have negative cases; invariant guardrails apply to every task even where not repeated in its task row.

## Browser E2E strategy

Use deterministic vendor mocks for most Playwright state/error coverage, clearly in test mode and never in a live evidence namespace. Run web and worker against a disposable Postgres DB. Assert visible report gating, network responses, cookie ownership, console state and client-bundle sentinel absence; a screenshot alone proves nothing about authorization. Run one separately recorded real browser/CLI journey with Testnet and the actual model after the live gates. Freighter approval can be manual during that live rehearsal; do not pretend automated wallet mocks signed real transactions.

## Release gates and evidence

Before claiming a live MVP: typecheck/lint/build, all required unit/integration/browser checks, at least two genuine Velo-sponsored Noir successes, one actual deployed-contract over-cap refusal, an expired-policy refusal, a separate merchant claim, replay/recovery tests and a real model price-change rehearsal. Record whether refusal occurred in RPC simulation or an included transaction. No simulated proof qualifies as a ledger transaction. One success is sufficient only for the early compatibility spike.

Real test evidence captures versions, contract/network/SAC, observation time, quote/operation, reservation identity, inner/outer mapping, event/ledger, before/after balances, fees or null, refusal type and claim hash/result. Store redacted JSON under `docs/evidence/testnet/` when generated; that folder has no successful evidence at handoff. Testnet reset or contract redeployment invalidates the live gate until rerun.

Performance goal from the seed remains a target, not an acceptance shortcut: optionally measure 20 complete runs, p50/p95 and outcomes using methods. Do not spend limited demo time on benchmarks before correctness works.

## Exit criteria / remaining manual checks

The coding agent records exact command, result and artifact in the task plan. Manual checks: wallet consent/network, keyboard/focus/contrast smoke, official event eligibility and honest presentation/recording labels. No app test pass is inferred from this document or from the deterministic documentation checker.
