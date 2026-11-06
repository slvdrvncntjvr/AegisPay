# System design

**Status:** selected architecture; live compatibility not yet established. Origin: PRD and [research](research.md).

## Context diagram

```text
Owner / merchant Freighter wallet
        | owner-reviewed setup / merchant claim signatures
Browser console --session--> Next.js Node UI + API
                                  | PostgreSQL state/queue
                                  v
                           Private Node worker
                     / model tool loop + payment adapter \
            Claude API       Noir SDK           Velo Gas
                                \               /
                                 Stellar Testnet
                                       |
                              RPC evidence reconciliation
                                       |
                           DB evidence + entitlement commit
                                       |
                           API protected fixture delivery
```

## Components & responsibilities

One root package, no pnpm workspace. Proposed paths are creation targets, not existing code:

```text
src/app/                 App Router console, login and route handlers
src/server/auth/         demo roles, sessions, origin checks
src/server/db/           Drizzle schema, SQL migrations, queries
src/server/domain/       quote/attempt/budget/entitlement rules
src/server/integrations/ Noir, Velo, Stellar evidence, model adapters
src/server/merchant/     public catalog + private report fixtures
src/server/agent/        tool definitions, runner, redacted run events
src/worker/              durable jobs, payment orchestration, reconciliation
scripts/                 contracts, seed, live spike, demo controls
tests/                   unit, integration, testnet and browser suites
```

Web owns session-authenticated intent and reads. Only the worker process gets `AGENT_SECRET`, Velo API key, model key and envelope encryption key. Web can prepare owner/merchant transactions and verify returned wallet signatures; it cannot spend as the agent. DB owns quotes/operation identity and entitlements; the chain owns policy and balances. Public client code never imports server fixtures or signer modules. Mark server imports with `server-only` where appropriate; worker-only modules do not rely on browser bundles for isolation.

## Data flow

1. Owner signs prepared setup XDR via Freighter. Store unsigned intent hash, source, operation and expiry. On return verify signature, network, unchanged body and exact operation; submit through the verified Noir owner flow. Re-read confirmed policy and escrow. Never trust a wallet address supplied by the browser as authentication.
2. API accepts a run, creates its DB row and job atomically, returns 202. Worker loads trusted catalog. Model can call only `discover_offers`, `request_quote`, `purchase_quote`, `read_purchase`; input schemas use resource/quote IDs, not arbitrary URLs or amounts. Execute tool calls sequentially, even if the model emits several.
3. Request the real protected demo HTTP route using a short-lived worker session scoped to the run/owner. It returns 402. Store and validate the server quote rather than trusting copied model fields.
4. In a DB transaction lock agent/run/quote, enforce freshness and policy snapshot, create one immutable operation/attempt and reserve budget. Allocate a strictly increasing per-device/agent nonce and save it. Take one per-agent active-payment lease to serialize account sequence. SQL uniqueness is the final concurrency boundary.
5. Call live Noir preflight, then `noir.prepare(agentPublicKey, { kind: 'authorize', deviceHash, merchant, asset, amount, nonce })`. This shape is verified in published 0.3.0 declarations. Inspect the simulated transaction and auth tree, sign with the scoped agent signer, compute inner hash. Check one top-level allowed invocation and no unexpected auth/sub-invocation; approved token/registry calls must match the inspected contract spec.
6. Encrypt the signed envelope at rest before sponsorship so pre-handoff recovery can reuse exact bytes. Persist its SHA-256 fingerprint and immutable intent. Call Velo `gas.sponsor` with stable operation-derived idempotency key; persist request ID and returned inner identity and compare to local hash before continuing. This explicit form replaces the composed helper to make the durable boundary clear.
7. Recheck quote deadline before first handoff. Persist `handoff_committed_at` before `gas.submit`. Exactly one process may dispatch it. After this marker, crash recovery never resubmits, even if the crash happened just before the network call. This can sacrifice availability; it cannot double-charge by automatic replay. Delete encrypted envelope once handoff is committed; identity-only recovery is sufficient afterward.
8. `getStatus` observes Velo and RPC queries independently inspect the successful envelope, invocation, result/meta and matching Noir authorization event. Decode fee-bump wrapper to verify inner hash; do not assume the event's transaction hash is always the inner hash. Preserve the raw observed event hash and verified inner/outer relationship.
9. Evidence must match network, configured escrow contract, source/signing agent, device, merchant, asset, amount, nonce and saved operation. Noir's decoded event omits asset and agent; derive those from the verified invocation/envelope, not invented event fields. A succeeded Velo status without available matching chain evidence stays unresolved.
10. In one DB transaction insert unique evidence and entitlement, mark attempt authorized/quote paid, convert reserved budget to spent, and append a safe audit event. Resource read requires session ownership and receipt validation. Reports remain server-only and uncached.

### Lifecycle and recovery

Attempt statuses: `accepted → preparing → signed → sponsoring → reserved → submitting → submitted → authorized`. `submitting` means durable handoff intent; ambiguous outcomes become `unknown`, never auto-failed. Before handoff, deterministic denial becomes `refused` or freshness failure becomes `expired`. A confirmed chain failure becomes `failed`. Contradictions/history gaps become `manual_review`. `authorized` is terminal and cannot regress due to later observation failures. Fulfillment and merchant claim are separate entities, not extra payment states.

Only release a budget reservation when it is provable no successful authorization happened: pre-handoff refusal/expiry, or matched definitive terminal non-success. Pending/unknown/manual-review keeps the reservation. For late success after timely handoff, authorize at the original accepted terms and start the normal entitlement window. For anomalous post-deadline dispatch or inconsistent evidence, retain manual review; no auto-refund is implemented or promised.

Worker lease expiry permits resuming observation, not redispatching money. Reserve calls with no returned identity may recover using the exact encrypted envelope and same idempotency key only while handoff is absent; if identity cannot be recovered, stop as unresolved. New nonce, new signature or fresh quote is never an automatic recovery action. Recovery after server restart resumes saved attempts before accepting a new agent payment.

### Agent loop

Use Anthropic's client-tool round trip directly; no LangChain or agent framework. Default `AGENT_MODEL=claude-haiku-5-5` is configurable after model-access smoke test. Limit a run to 8 model turns, 12 tool executions and 90 seconds of active reasoning. These limits stop further intent; they never cancel chain reconciliation. If payment outlives the run, persist `waiting_payment`, reconcile to completion and resume once using stored tool-call identity. On restart an ambiguous completed tool action is recovered by quote ID, not repeated. No model-generated financial numeric values are authoritative.

## Key technology choices + rationale

Exact metadata pins below were observed, not installed/tested. TASK-001 must install exact versions, check peers and write a lockfile. Keep one copy of Stellar SDK; reject peer override/force installs.

| Choice / selected pin | Why | Trade-off | Alternative rejected |
|-----------------------|-----|-----------|----------------------|
| Node **24.22.1**, pnpm **12.18.0** | Local runtime meets Noir engine; one JS runtime | Pin runtime in local/container config | Node 20, unverified latest runtime |
| Next **16.4.5**, React/React DOM **19.3.1** | UI/API in one package | Framework conventions need pinned-doc checks | Separate SPA and Express server |
| TypeScript **7.0.2**, Tailwind **4.3.5** | Strict types and quick console styling | Build compatibility still requires setup gate | Custom design infrastructure |
| PostgreSQL **17** stable line, Drizzle **0.45.4**, drizzle-kit **0.31.11**, pg **8.23.1** | SQL constraints, locks and migrations | DB setup required; image digest pinned at setup | SQLite for concurrent payment flow; Prisma as second ORM |
| Zod **4.6.7** | HTTP/tool validation | Some SQL invariants must also be enforced | Trusting TypeScript at runtime |
| Noir **0.3.0**, Stellar SDK **16.4.1** | Published peer compatibility and prepare API | SDK deployment defaults are stale for brief | Stellar 17.4.0 latest violates Noir peer |
| Velo **1.0.0** | Required sponsor/submission integration | Alpha/Testnet service dependency | Unrelated checkout integration |
| Anthropic SDK **1.6.0** | Direct bounded tool loop | Model access/key needed | Framework orchestration and multi-model routing |
| Freighter API **6.0.1** | Owner/merchant browser signing | One supported wallet | Secret-key input in browser |
| tsx **4.23.15**, Vitest **5.1.0**, Playwright **1.65.0** | Worker/scripts and appropriate verification | Real chain tests remain separate | Mock-only acceptance |

See [research](research.md) for primary links and [registry snapshot](evidence/package-research.json) for engine/peer ranges and integrity. Include exact compatible peer/type/style helper versions as needed at setup; those secondary package pins are not yet researched. No automatic upgrade in the middle of the demo build.

## Integration points

Use explicit environment-provided Noir contracts, RPC/passphrase and verified Testnet XLM SAC; derive SAC through the pinned Stellar native-asset helper and confirm it on chain. Verify contract Wasm/spec and registry/escrow links, compare organizer IDs to SDK defaults, then record the chosen set. No undocumented RPC `get_contract_spec` method is assumed: inspect contract ledger entries/Wasm through supported RPC/CLI or generated client metadata.

The live spike in [the plan](implementation-plan.md) must establish virtual-device registration, successful authorization through Velo, event/inner/outer association, balances and claim. Disabled Gas, quota/allowlist failure, malformed SDK response and simulation failure all deny fulfillment. Do not use `authorizePayment`/`noir.submit` to submit the agent purchase before Velo. Direct Noir writes remain valid for human owner operations and merchant claim.

No Noir/Velo webhook routes in MVP. Unknown webhook paths return 404 and cannot mutate payment state. No paid third-party security feed; demo report fixtures are authored sample content, never live vulnerability advice.

## Deployment topology

Primary demo is local: Next server + private Node worker + PostgreSQL, with hosted model and Testnet services. Bind local server to loopback by default. Optional deployment target: one Railway project containing web, private worker and Postgres; use Node processes from the same commit/lockfile. Pin Node with a container when host defaults differ. No deployment or paid resources are created by this documentation task.

Web start is `pnpm start`; worker is `pnpm worker`; migrations run once before both accept traffic. Local web/worker configuration uses separate environment files as specified in onboarding/security; standalone scripts explicitly load theirs. Polling every 2 seconds replaces SSE/WebSockets for the console. Worker polls its SQL job queue and reconciles unresolved attempts with bounded exponential observation backoff. DB leases use DB time; no sleeping while holding transactions.

## Scaling strategy

One web and one worker replica, one active run per agent, one agent only. Use `FOR UPDATE SKIP LOCKED` for jobs and scoped unique indexes for payment constraints. More replicas/agents, long-term event indexing and production throughput are deferred until measured demand exists. Correctness tests use independent DB connections despite a single deployed worker.

## Trade-offs considered

The queue shares PostgreSQL to avoid another service. Identity-before-handoff improves recovery but conservatively stalls a crash-before-send case. Signed-envelope encryption adds a small security boundary for recovering sponsorship; it is never a general signing service. A custom 402 adapter is explicit and tested without claiming x402 conformance. One gateway controls both demo merchants' HTTP resources, so it proves application context binding, not independent trustless merchant federation.
