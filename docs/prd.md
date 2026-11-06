# AegisPay — product requirements

**Status:** execution specification, 2026-11-07. Origin: [IDEA.md §§2–5 and §23](../IDEA.md). Technical readiness remains conditional on the live spike.

## Overview & goals

Prove one agent can choose and buy a demo API report using bounded Noir escrow authorization sponsored through Velo on Stellar Testnet. Prove replay and unresolved payment cannot release another report. Show merchant claim separately. Preserve every P0 outcome while limiting the app to one owner, one agent, one merchant wallet, two demo offers and XLM.

## Personas & use cases

The owner provisions and funds a restricted agent. The agent developer inspects a tool-driven purchase. The merchant operator prices fixtures, sees pending funds and signs a claim. One human may hold both demo roles, but the two wallet addresses are distinct.

## User stories

- As owner, I connect my Testnet wallet, register a virtual device/agent, set a cap and expiry, fund escrow, and revoke/reclaim without per-purchase approvals.
- As agent developer, I supply a task and inspect current offers, the model's concise stated rationale, a real 402 challenge and a purchase receipt.
- As merchant, I grant only the purchased resource and claim confirmed pending funds with my wallet.
- As judge, I reproduce setup and distinguish simulated fixtures from real Testnet activity.

## User journeys

- **UJ-001 — Setup:** authenticate → connect owner wallet → register device and policy → fund escrow → inspect confirmed policy/balance.
- **UJ-002 — Buy:** create task → model discovers both offers → requests a quote → deterministic tool reserves task budget → Noir prepare/sign → Velo sponsor/submit → reconcile → retrieve fixture → answer with receipt citation.
- **UJ-003 — Refuse:** local tool denies an excessive quote; isolated Testnet harness separately demonstrates rejection by the actual contract. No entitlement exists.
- **UJ-004 — Recover:** interrupt submission observation → reload saved attempt → recover identity-only status and chain evidence → grant once or retain unresolved state.
- **UJ-005 — Claim and reclaim:** merchant signs pending-balance claim; owner separately revokes agent and reclaims remaining device escrow without unlinking a funded device.

## Feature list (with priorities)

| F-ID | Feature | Priority | Solves (problem) | Notes |
|------|---------|----------|------------------|-------|
| F-001 | Wallet and virtual device | MVP | Bounded delegated identity | One verified owner |
| F-002 | XLM escrow | MVP | Finite available agent funds | Exact atomic units |
| F-003 | Policy and safe revoke/reclaim | MVP | Uncontrolled authority | No daily-limit claim |
| F-004 | HTTP 402 quote | MVP | Discoverable per-request price | Proprietary protocol |
| F-005 | Model/tool choice | MVP | Autonomous purchasing intent | Real catalog inputs |
| F-006 | Noir authorization | MVP | Contract-enforced payment | Off-model signer |
| F-007 | Velo execution | MVP | Sponsored submission | Same Noir call |
| F-008 | Evidence-gated fulfillment | MVP | Premature delivery | Two independent observations |
| F-009 | Replay/resource/owner checks | MVP | Reused payment proof | DB constraints |
| F-010 | Visible state and audit | MVP | Opaque failures | Redacted timeline |
| F-011 | Merchant claim | MVP | Collect pending funds | Separate lifecycle |
| F-012 | Reproduction and evidence | MVP | Unverifiable demo | Local-first handoff |

## Business rules

- **BR-001:** Only Stellar Testnet and one verified native-XLM SAC are enabled. Prices, balances, fees and nonce values use integer arithmetic; JSON uses decimal strings. Equations are in [methods](methods.md).
- **BR-002:** Default fixture offers are QuickSignal 300000 and DeepTrace 1200000 stroops; per-payment cap and per-run task ceiling are 1000000; initial escrow target is 10000000. These are demo configuration, not commercial prices. Policy expiry defaults to one hour from registration. Zero/no-expiry policy is refused by the app.
- **BR-003:** A run reserves its total accepted spend in a locked DB transaction before signing. One active run/payment operation per demo agent; the model cannot invoke concurrent payments or owner tools. Budget includes unresolved reservations. No automatic new quote/payment after a timed-out purchase.
- **BR-004:** Quote lifetime is 120 seconds. An attempt must pass freshness at acceptance and immediately before first sponsorship/submission; a stale unsubmitted operation cannot spend. A valid submission dispatched in time that confirms late still earns its entitlement. Expiry never cancels an already handed-off payment.
- **BR-005:** One 15-minute entitlement window starts when authorization is verified. Repeated reads of that same purchase during the window are allowed and never consume another payment. Different owner, quote or resource is denied. Expiry requires a new purchase; an unexpired prior receipt is recoverable by its authenticated owner.
- **BR-006:** Reconciliation retries observations, not financial handoff. Persist a Velo reservation identity before marking submission dispatched. A crash with ambiguous handoff remains unresolved; no automatic second submission.
- **BR-007:** Claim sweeps the merchant's pending balance for the single configured token. It may cover multiple authorizations. No one-to-one purchase/claim assumption or second entitlement is created.
- **BR-008:** Console sections are Policy, Run, Merchant and Audit. Private demo fixture bodies are readable only through the entitlement gate, including by the merchant preview. Public descriptions contain no protected report text.
- **BR-009:** Price edits affect future quotes only. Live SDK receipts and fixtures are labeled separately. RPC/SDK errors are rendered with stable safe codes. Unknown fees render “Unknown,” never zero.
- **BR-010:** An absent dependency/key can block an integration task; it does not authorize invented APIs, fabricated receipts, unrelated Velo checkout, or UI success states.

## Hard rules / must-never (invariants)

- **INV-001:** The system SHALL NEVER mutate accepted quote price, asset, merchant, owner, agent or resource.
- **INV-002:** The system SHALL NEVER create payment evidence from an unsuccessful or unrelated Noir invocation.
- **INV-003:** The system SHALL NEVER allocate one quote, authorization transaction or event to multiple entitlements.
- **INV-004:** The system SHALL NEVER mark authorization valid without both successful Velo execution and matching independent chain evidence.
- **INV-005:** The system SHALL NEVER grant protected data while payment is pending, unknown or failed.
- **INV-006:** The system SHALL NEVER fulfill a different owner, quote or resource from the recorded entitlement.
- **INV-007:** The system SHALL NEVER let model-controlled content change trusted providers, spending policy or accepted prices.
- **INV-008:** The system SHALL NEVER present a local preflight rejection as proof of live contract enforcement.
- **INV-009:** The system SHALL NEVER equate authorization with merchant claim or accept Velo Pay webhooks as Noir payment evidence.
- **INV-010:** The system SHALL NEVER blindly resubmit an uncertain financial operation or create another attempt for a retried quote.

Enforcement maps to [security threat rows](security-compliance.md), [QA negative cases](qa-test-plan.md) and [UX copy rules](design-system.md).

## User flows

The owner authenticates to the invite-only console, connects Freighter, and signs each setup change explicitly. Once policy and funding are ledger-confirmed, a submitted task runs asynchronously. The agent receives public metadata, then a 402 quote, then a pending tool result or the purchased report. The console polls durable state. A worker crash never turns a second tool call into a second payment. The merchant signs claim independently. Safe recovery/revocation remains available when new purchases are disabled.

## Acceptance criteria

- **F-001:** WHEN owner setup completes, the system SHALL show the confirmed device owner and agent matching the configured deployment.
- **F-002:** WHEN funding confirms, the system SHALL display the exact escrow amount and configured SAC from chain reads.
- **F-003:** WHEN a finite policy is set/revoked, the system SHALL reflect ledger state and demonstrate contract refusals; reclaim SHALL precede device removal.
- **F-004:** WHEN an authenticated caller requests a protected resource without valid entitlement, the system SHALL return 402 with immutable server-stored quote terms and no report body.
- **F-005:** WHEN a run starts, the model SHALL receive both current offers and choose tools based on those inputs, with a concise stated reason; no secret or private reasoning transcript is requested.
- **F-006:** WHEN accepted intent passes guards, the system SHALL construct one matching Noir authorization with persisted nonce and inner hash, then sign outside the model.
- **F-007:** WHEN sponsored execution succeeds, the system SHALL retain Velo reservation, inner/outer transaction identities and observed execution status for that authorization.
- **F-008:** WHEN both observations match, the system SHALL atomically create evidence and entitlement; any mismatch SHALL retain denial/manual review.
- **F-009:** WHEN proofs are replayed or substituted, the system SHALL deny cross-purchase access and retain at most one entitlement.
- **F-010:** WHEN state changes, the system SHALL show redacted quote, policy, attempt, ledger and claim evidence without falsely resolving unknown state.
- **F-011:** WHEN merchant claim confirms, the system SHALL show its own transaction and claim outcome without changing existing purchase authorization.
- **F-012:** WHEN a fresh checkout follows onboarding, its documented gates SHALL reproduce the local app and clearly separate mock tests from real Testnet artifacts.

## Non-goals

All exclusions in IDEA.md §5.3 hold. Also exclude full SaaS accounts, public signup, generic wallet support, a generalized merchant SDK, Redis, Kubernetes, background workflow frameworks and a generalized daily spending policy. No market validation project is required before this hackathon build.

## Dependencies

See [research](research.md) for observed package facts and [implementation plan](implementation-plan.md) for integration gates. Testnet wallets/funds, configured Velo Gas access and a model API key are external prerequisites.

## Open questions

Only external evidence remains open: event eligibility, mandatory contract deployment and live interoperability. These belong to the initial spike. Routine stack, scope, auth, receipt, expiry and recovery choices are resolved here and in their canonical implementation owners.
