# AegisPay finals technical readiness assessment

Assessed **9 November 2026** against local `main` **180a88d**, the saved 8 November checkpoint, actual implemented source, preserved Git objects and anonymous production GETs. This is an assessment: no application implementation, task-state change, checkout, stash restoration, dependency installation, credential inspection, deployment, upload, signing or Testnet write was performed. Authored files are limited to this report and `technical/` artifacts; the permitted compiler check can refresh an ignored incremental cache. No tracked application or canonical-document diff was present at delivery.

**Verdict: a credible, genuinely evidenced Noir/Velo integration and useful application foundations; not yet a finals-ready autonomous purchasing application.** The current website is a saved-proof viewer. The biggest competitive improvement is completing and demonstrating the missing end-to-end purchase and recovery journey. A visual refresh or another observation of the old transaction cannot close that gap.

The supplied Nov 8 organizer email names AegisPay Top 15. Treat that as user-supplied selection evidence, not a winning guarantee. Finals date and venue remain TBA; this assessment does not reinstate older speculation about eligibility or require another registration inquiry before useful technical work.

Preserve **AegisPay** and these exact submitted destinations:

- Website: https://aegispay-live.vercel.app/
- Deck: https://github.com/slvdrvncntjvr/AegisPay/blob/main/docs/submission/AegisPay-pitch-draft.pdf
- Video folder: https://drive.google.com/drive/folders/1hqwzOaG_qU9axjcLIjBUb1YeMWdOFq72?usp=sharing

Content can later change at those paths after the relevant implementation/release work. This assessment changed none of them.

## Evidence standard and current checks

**Observed** means source/file/Git inspection or a command/GET actually performed in this assessment. **Historical** means saved evidence/checkpoints from earlier runs, without a new live-verifier execution. **Inferred** means a consequence of inspected code. **Unverified** means no adequate current execution evidence.

| Check | Current result | What it establishes |
|---|---|---|
| `node node_modules/typescript/bin/tsc --noEmit` | PASS, exit 0 | Root installed-source typecheck |
| Same compiler with `--project apps/web/tsconfig.json` | PASS, exit 0 | Web typecheck; equivalent two projects to the package's typecheck script |
| `npm.cmd run lint` | PASS, exit 0 | Configured ESLint check |
| `npm.cmd run test:unit` | PASS, exit 0; **73 tests, 4 files** | Pure amount/protocol/intent/model-adapter cases; no real Gemini purchase |
| `npm.cmd run test:spike` | PASS, exit 0; **50 tests, 0 failures/skips** | Explicit synthetic/offline SDK, verifier, handoff and journal regressions; no live chain refresh |
| `python tools/check-docs.py` | PASS, exit 0 | 21 canonical Markdown files; structural links/requirements, not semantic freshness or app completeness |
| `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` | PASS, exit 0 | 13 task rows and coherent declared DAG; not readiness of their implementations |
| Integration, browser E2E, production build, real model, live Testnet | **Not rerun** | Historical 46 PostgreSQL tests/build/model connectivity do not become new observations |

Artifacts: [typecheck results](technical/typecheck-results.json), [lint](technical/lint-rerun.txt), [unit tests](technical/unit-rerun.txt), [offline spike tests](technical/spike-rerun.txt), [documentation checks](technical/docs-check-results.json), [public GET observations](technical/public-get-observations.json).

The initial four `pnpm` attempts did **not** run: this terminal could not resolve `pnpm`. Their PowerShell pipeline wrapper misleadingly returned zero, which is not counted as success. Installed npm/Node alternatives above then passed without installation. npm warned that it did not recognize the pnpm-specific `strict-peer-dependencies` configuration; no install or peer override occurred. The first documentation wrapper hit a console encoding error after the checker passed; a UTF-8 rerun completed both checkers. Web browsing could not fetch the app, so independent Python HTTPS GETs were used successfully. An initial literal-file read argument was corrected. See [inspection failures](technical/inspection-failures.json). No DB/container was started and no ignored environment/private payment journal was opened.

## What is actually implemented and deployed

| Capability | Actual main/source | Production / evidence limit |
|---|---|---|
| Saved payment proof console | `page.tsx` renders `ProofConsole`; its three tabs display imported `PUBLIC_PROOF` constants | Observed `/` **200**. Historical proof presentation, no runtime verification or transaction creation |
| Minimal health | `runtimeHealth()` validates a fixed `ok/testnet` object | Observed `/api/health` **200**; proves endpoint availability only |
| Private authentication and wallet APIs | Opaque hashed sessions, owner/merchant roles, scoped worker auth, origin/body/rate rules, prepared-body/signature binding | Main contains these; observed production `/login`, `/api/v1/state`, example run GET all **404** |
| PostgreSQL financial foundation | Immutable quotes, nonce/budget locking, attempts/jobs/evidence/entitlement tables and SQL guards | Historical 46 PostgreSQL 17.11 integration tests. No current DB or deployed application-store verification |
| Durable application payment executor | **Absent from main**; `apps/server/src/index.ts:4–9` says `jobExecution: 'unimplemented'` | No working deployed consumer established |
| Real Gemini adapter | Bounded REST function-calling adapter, strict tool schemas, provider-content handling and safe errors | Historical harmless tool round trip; current 73 unit tests include mock adapter checks. No complete purchasing-agent run |
| Model loop | `packages/agent/src/index.ts:3–29` implements only a pure in-memory bounds/intent guard | No discover → quote → pay → await → read → answer loop, durable checkpoint/resume or live price-change proof |
| Merchant paid-resource endpoint / receipt reads | Financial grant function exists, but protected-report/receipt HTTP path is absent on main | No actual 402-to-protected-report journey or delivered paid fixture established |
| Product UI | Public proof tabs plus a private login component and unused Freighter helpers | Login redirects to `/app`, which has no main route. No owner setup/task/merchant product console |
| Merchant claim | Saved spike has a separate real claim. Main wallet API supports prepared/signed claim verification | Historical SDK claim is not a completed browser claim flow |

Source anchors: [page:4](../../apps/web/src/app/page.tsx#L4), [console:8](../../apps/web/src/app/console.tsx#L8), [public-proof:6](../../apps/web/src/lib/public-proof.ts#L6), [health:1](../../apps/web/src/app/api/health/route.ts#L1), [application:12](../../src/server/http/application.ts#L12), [worker bootstrap:4](../../apps/server/src/index.ts#L4), [agent guard:3](../../packages/agent/src/index.ts#L3), [login redirect:10](../../apps/web/src/app/login/page.tsx#L10).

### The production fallback is useful, but materially older than main

Anonymous GETs at approximately **07:16 UTC Nov 9** returned:

| URL at the exact submitted origin | Result |
|---|---|
| `/` | 200 HTML, saved operation/amount/nonce/authorization/claim/hash links |
| `/api/health` | 200 JSON `{"status":"ok","network":"testnet"}` |
| `/login` | 404 HTML |
| `/api/v1/state` | 404 HTML |
| `/api/v1/runs/00000000-0000-4000-8000-000000000000` | 404 HTML |

The source root imports only public constants, and the tab component changes local UI state. It does not run Gemini, call a payment API, check a database, retrieve fresh chain policy or verify the displayed hashes at runtime. This makes it an effective backend-independent replay fallback. Its success labels are snapshots, not a present-tense dependency monitor.

Do not infer that login/DB routes work in production because they compile on main. Do not infer a deployed commit hash from HTML alone. The saved delivery report names an earlier deployment; this assessment did not inspect Vercel's authenticated deployment settings. Local `.vercelignore` has since expanded to permit web API/server dependencies, but still excludes worker/model/payment-verifier modules: it is not a complete worker-hosting package. Root install/build reproducibility must be proved again from the actual uploaded source when the full app is deployed.

The separate [UI audit](ui-audit.md) independently observed production **597px Run content at a 390px viewport** despite local CSS containing the wrapping repair. It also observed production `.list a` wrapping differs from local. That is a concrete deployed/local mismatch, not permission to assume the fix shipped. This technical worker did not repeat those browser measurements.

### Historical evidence: one authorization, one separate claim, one unsigned refusal

The [latest saved artifact](../evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794064999769.json) and public constants agree on:

- Operation `c080d947-714b-43cf-92d0-ad9ed7c01439`; **300000 stroops = 0.0300000 Testnet XLM**, nonce **1**.
- Inner authorization hash `1d39c3e3d7f400475aa2686f173a943346c5870635731fbd62fa41f1f912fa7a`.
- Outer fee-bump / observed event hash `6e898ad830e866f0831577849361739cea7ad03cfbfcee9febf0fc057633d381`, authorization ledger **5607680**.
- Separate merchant claim hash `94cea8bb561576ab71d4419571b92bd2fe7d8eada1273ff16960a716160c9a18`, ledger **5607763**.
- Authorization moved escrow **10000000 → 9700000** and pending **0 → 300000**; the separate claim moved pending **300000 → 0**.
- Actual fee **82496 stroops**, recorded as matching outer charged fee and Velo reported fee. One Testnet sample cannot establish production cost or unit economics.
- Over-cap **1200000** against cap **1000000** returned `AgentNotAuthorized` in actual contract simulation; artifact explicitly says **includedTransaction=false, signedOrSubmitted=false**.

These are historical records inspected here, **not** a new live RPC/Velo verifier pass. Earlier report files and later observations of the same identities still describe **one unique authorization**. The claim is another transaction with another role, not a second purchase. The spike does not establish a paid QuickSignal resource, 402 quote, entitlement, model decision or delivered report; do not retrospectively assign it those fields.

The saved policy expired **7 Nov 2026 at 15:32:08 UTC**. It cannot authorize a new purchase today. Any live rehearsal needs a currently verified finite policy, current chain/network/contract checks and deliberate identity/nonce handling. A fresh database seeds `lastNonce=0` ([schema:38](../../src/server/db/schema.ts#L38)); reusing the already-used spike device/agent identity without a nonce-bootstrap plan risks trying nonce 1 again. This is a preflight risk, not a verified observed replay failure. Never reset the historical journal/nonce to make another demo run appear new.

## Trust boundaries and correctness assessment

### Strengths worth defending in Q&A

1. **Model proposals have no financial authority.** Shared discriminated schemas allow only `discover_offers`, ID-based `request_quote`, `purchase_quote` and `read_purchase`; extra price/URL/owner tools are rejected. The Gemini adapter independently validates canonical tool declarations and response calls, bounds body/time/parts and keeps full provider content non-enumerable. Current unit tests exercise mock malicious/malformed responses and secret redaction. System instructions help behavior; the schemas and deterministic server checks are the actual security boundary. See [shared tools:47](../../packages/shared/src/index.ts#L47), [model tool validation:101](../../src/server/integrations/model.ts#L101), [model client:343](../../src/server/integrations/model.ts#L343).

2. **Payment intent is inspected before signing and again during evidence verification.** `inspectAuthorization` binds Testnet, source agent, one invocation, finite timebounds, exact escrow/function/arguments including merchant/asset/amount/nonce, and restricted authorization roots. It rejects extra/foreign operations and authorization children. See [noir:34](../../src/server/integrations/noir.ts#L34).

3. **Velo success is necessary but insufficient.** Reservation validation checks request identity, inner hash, source, exactly one target escrow and expiry. Execution checks matching request/hash, succeeded status, outer hash and no reconciliation requirement. The independent chain verifier checks successful inner/outer results, mapped hashes, valid agent signature, exact invocation and the matching embedded contract event. An event alone lacks agent/asset/nonce context. The adapter handles a missing legacy RPC success flag by matching the actual successful metadata; it does not synthesize a flag. See [Velo:10](../../src/server/integrations/velo.ts#L10), [chain verifier:46](../../src/server/integrations/stellar-evidence.ts#L46), [event decoder:14](../../src/server/integrations/stellar-evidence.ts#L14).

4. **The spike protects the uncertain handoff boundary.** It saves reservation identity and commits an exclusive durable marker before its only `submit(maxRetries:0)`, deletes ciphertext before dispatch, and performs status-only observation after the marker. A crash after marker/before send may stall permanently; it does not justify another financial handoff. This is conservative at-most-once application dispatch, **not a guarantee every intended payment executes exactly once**. See [handoff:37](../../src/server/integrations/velo.ts#L37), spike journal, and current 50-case synthetic suite.

5. **The DB foundation is substantive.** Canonical agent → run → quote → attempt locks, immutable term hashes, atomic nonce increment and budget hold, idempotency bindings, unique authorization/event/grant identities and deferred accounting triggers are real code. Unknown attempts stay reserved. `attachVerifiedEvidence` binds an independently verified observation to the exact durable context and commits evidence, entitlement, spend and paid state together. SQL protects against direct inconsistent state transitions. See [purchases:17](../../src/server/domain/purchases.ts#L17), [accept:76](../../src/server/domain/purchases.ts#L76), [grant:25](../../src/server/domain/evidence.ts#L25), [financial guards](../../src/server/db/migrations/0001_financial_guards.sql), [terminal provider guard](../../src/server/db/migrations/0003_terminal_evidence_guard.sql).

6. **Human setup/claim authority is separated from agent spending.** Login secrets map to configured roles; wallet connection is not login. The server checks signer, source, exact prepared body/hash/network/timebounds, wins a durable one-time handoff and then observes the saved hash. Claim amount comes from the independently successful embedded event and updates a separate merchant-claim record. See [sessions](../../src/server/auth/session.ts), [wallet preparation:58](../../src/server/domain/wallet.ts#L58), [wallet submit:109](../../src/server/domain/wallet.ts#L109), [claim observation:146](../../src/server/domain/wallet.ts#L146).

### Boundaries that must not be overstated

- **The DB grant function trusts its internal caller to have run the independent verifier.** Its `chainSucceeded:true` and `veloStatus:'succeeded'` schema are not cryptographic evidence by themselves. It is deliberately internal; keep it unreachable from browser/model/raw JSON. Currently no HTTP proof-ingest or webhook route exists. Future worker wiring must fetch RPC/Velo itself and pass the verified mapping, never grant from client success flags.
- **Task budget and merchant/resource allowlists are application controls.** Noir's inspected authorize ABI contains agent/device/merchant/asset/amount/nonce, not quote ID, resource ID, task ID or task budget. The supplied contract enforces its policy; the application binds paid content to a resource. A compromised agent signing key could attempt repeated individually permitted transactions outside the application's task budget. Finite escrow/expiry/revocation limit exposure. Do not claim on-chain cumulative daily/run budgets or cryptographic resource binding.
- **PostgreSQL schema is not a running recovery worker.** Main queues run/reconcile/wallet-observe jobs but the entrypoint consumes none. The in-memory guard's counters/unresolved quote are not durable model checkpoints. Reinitializing it on restart would erase those bounds unless the future loop reconstructs them from durable run state.
- **Wallet recovery is conservative but incomplete.** `observeWallet:143–175` recognizes success, while an included failure/NOT_FOUND/RPC exception all become unknown. `prepareWallet:67` blocks another prepared/submitting/unknown operation for that wallet. No definitive-failure resolver/operator recovery path or active observer consumer is implemented. This is safe denial but can block owner or merchant actions for the demo; never “fix” it by deleting unknown rows or resubmitting.
- **Real human wallet lifecycle remains unverified.** Existing wallet integration tests explicitly use synthetic SDK transport and cover rejection/one-time handoff/reclaim denial, not a real Freighter setup → funding → revoke → reclaim journey. No full browser release or fixture/bundle leakage suite exists on main. Failure to expose a protected endpoint today is not evidence that the future endpoint's entitlement checks work.
- **Deployment secrets and freshness are unverified here.** The historical delivery report says its proof-only project had zero environment variables. Do not infer today's settings or that worker secrets should be added to Vercel. Agent/Velo/model/envelope keys belong to the worker process; web gets only its required shared DB/public network/auth/receipt configuration. No secret inventory was read in this assessment.

## History reconciliation and recoverable unfinished work

Read [final-checkpoint.md](../submission/final-checkpoint.md) before interpreting older paragraphs in index, system design, QA or the decision ledger. On main, TASK-001/002/003/004/011 rows are **done**. Several prose summaries still say TASK-004 ready, no DB/workspaces or pending spike fixes. The latest saved checkpoint and implemented source supersede those historical descriptions. TASK-004's done row expressly retains real Freighter consent as a release gate.

TASK-005 is marked blocked although its declared dependency TASK-004 is done. The next implementation session should reconcile it to the appropriate executable state and claim it with evidence. This assessment makes **no task changes**. TASK-006–010/012/013 remain unfinished; a partial static deployment does not complete TASK-012's app/worker/DB gate, and existing deck/video assets do not complete TASK-013's joined release gate.

Read-only Git inventory confirms preserved local Gemini, submitted-link-delivery, application-executor and foundation branches. They are not exact ancestors of current main; individual useful changes were merged/cherry-picked, so branch existence alone is neither new feature evidence nor a safe blanket merge plan.

`stash@{0}` is **a85a677bc234e3e06c30341d23a20050739c99f2**, “Preserved unfinished payment-worker source before user-requested shutdown.” Its untracked tree **fbadc8ef3c36aa8f6de8a62948633d6065716004** contains:

- `apps/server/src/worker/{payment,live-adapter,queue,ingress}.ts`;
- `src/server/http/wake.ts`, `src/server/merchant/{receipts,reports}.ts`;
- `tests/integration/{payment-recovery,purchase-flow}.test.ts` plus a synthetic adapter.

Tracked stash changes also extend the HTTP application, API route and receipt context in `evidence.ts`. Source inspection shows a promising encrypted-envelope/lease/CAS handoff implementation, independent-verifier adapter, HMAC receipts, gated fictional fixtures and crash tests. **None of that code is active on main or included in the current passing test counts.** Do not pop/import it wholesale: inspect and reconcile the complete related change set, current `.ts` versus `.js` import behavior, receipt-context typing, consumer/entrypoint wiring, lease loss/crash paths, and run its meaningful PostgreSQL tests. Stashed tests are intentions until executed successfully. The three historical AegisPay DB containers were stopped with volumes retained, per the saved checkpoint; no data recovery or Docker changes were attempted here.

## Prioritized technical findings

Effort is a solo engineering estimate, not a delivery promise. Ranges assume existing accounts work and exclude organizer waiting, hosting access, quota outages and chain recovery delays. Work overlaps; do not add every row as independent calendar time.

| Priority / finding | Evidence and demo consequence | Required outcome / dependencies | Estimate |
|---|---|---|---|
| **P0-1: No executable autonomous purchase chain** | Worker bootstrap unimplemented; agent package is a guard; application routes end without catalog/run POST/payment/report/receipt handlers. A judge cannot give it a task and receive purchased data. | Finish TASK-005 CLI paid-resource slice and TASK-006 recovery before TASK-007 durable real Gemini loop. Use current server catalog, immutable 402 quote, one accepted attempt, worker signing and verified report gate. | **18–32h** for payment/receipt/recovery slice; **8–16h** more for model-loop integration; credentials and current Testnet policy required for live gate |
| **P0-2: Production is the proof fallback, not the app** | Live login/state/run GETs 404; health stays green without DB/model/worker. Main login redirects to missing `/app`. | Implement product route; deploy tested web API + durable Postgres + separate worker; preserve exact website URL and archived proof mode. Confirm actual uploaded sources, auth boundary and readiness from the deployed commit. | **6–12h** after backend/UI integration; service/account access and correct public origin required |
| **P0-3: Paid fulfillment/recovery release evidence missing** | Internal atomic grant exists, but no working receipt/report surface or application executor. Only one historical authorization, not QA's two distinct live successes. | Prove two unique successful purchases, genuine contract refusals, late/unknown identity recovery, no duplicated handoff/grant, ownership/resource/window checks and separate claim. Fixture/secret E2E leakage gates before calling it complete. | **6–12h** focused hardening/rehearsal after core paths; may expose additional repairs |
| **P0-4: Existing policy is expired; fresh identity/nonce setup unproved** | Public proof expiry is Nov 7; new DB starts nonce zero; current product has no setup UI. Existing spike reruns observe saved identity. | Verify deployment tuple/current network, configured wallets, current finite policy/escrow, Velo sponsorship readiness, DB nonce continuity and stable operation identities before live run. Preserve old proof unchanged. | **2–4h** rehearsed setup after wallet UI; external wallet approvals/Velo availability |
| **P1-1: Auth/wallet code lacks a usable product flow** | Login → missing `/app`; Freighter helpers have no calling controls. Wallet failure remains unknown and blocks further ops. | Build owner/merchant controls with explicit human consent, role-separated state, observed balances, safe refusal/unknown displays and definitive failure/manual-review handling. Rehearse actual wallets. | **6–10h**, can partly overlap after stable APIs |
| **P1-2: Crash restart and sleep wake are not deployed capabilities** | Jobs/schema exist; main consumes nothing. Stash has ingress/queue pieces but no accepted wiring. | Restore selected source through review, integrate queue loop/lease fencing/checkpoints, authenticated bounded wake ingress, startup recovery and safe status-only resume. | Included in core estimates; hosting rehearsal **2–4h** additional |
| **P1-3: Readiness and runtime observability are too thin** | Fixed `ok/testnet` health; no job heartbeat, current policy or model readiness. `createWalletGateway:7` performs full contract verification anew per construction. | Keep public liveness minimal; add safe authenticated readiness and timestamps/heartbeat. Measure wallet reads and avoid repeated full Wasm/ABI verification on tight polling while retaining verified deployment provenance. | **2–4h**; performance risk inferred, not measured |
| **P1-4: Public deployment/UI mismatch can hurt presentation** | UI worker observed 597px Run overflow at 390px despite local wrap fix. Historical delivery says repair pending. | Ship and verify the narrow repair from actual deployed artifact; test projector/tablet/mobile and authenticated UI states. | **1–2h** after authorized deployment; see UI report |
| **P1-5: Stale status/deck copy hides real progress and remaining gaps** | Done rows conflict with old summaries; current media does not show a model purchase. | After implementation, reconcile factual statuses and update deck/video at the existing paths. Show actual new tool/receipt/recovery evidence, not relabeled spike footage. | **2–4h** factual reconciliation plus media work owned separately |
| **P2-1: Technical differentiation needs a sharper claim** | Limits/expiry/key isolation are established industry features; resource binding remains app-side. | Lead with a demonstrated uncertainty/fulfillment boundary on Noir + Velo, then show why that protects a paid API workflow. Avoid world-first/security-guarantee claims. | **1–2h** narrative/Q&A work after proof |
| **P2-2: Metrics and commercial assertions lack backing** | One Testnet authorization and fictional report catalog; no customers, paid demand or production benchmarks. | Quote measured timings with sample/outcome; label fixture value/prices as demo assumptions. Do not claim low-cost production, savings percentages, audited security or broad merchant interoperability. | **1–2h** measurement notes; market validation is separate |

The critical path is approximately **4–8 focused solo working days**, with external prerequisites and repair uncertainty. This is a planning estimate derived from the missing slices, not proof they can be completed before a TBA finals date. Do not spend that interval rewriting architecture or adding generalized daily budgets, multiple chains, NFC hardware or custom contracts.

### Free-hosting implications verified against current official documentation

Render still offers free web services rather than free background/private workers. Its free web services sleep after **15 minutes without inbound traffic**, can take about **one minute** to wake, lose local filesystem changes on sleep/restart/redeploy, and cannot receive private-network traffic. Free Postgres expires **30 days after creation**. These facts make a PostgreSQL-backed worker exposed only through authenticated wake ingress a reasonable demo adaptation, but do not prove it is implemented. Warm actual backend services before the pitch, retain state in SQL, and rehearse a cold restart. Confirm DB creation/expiry relative to finals once scheduled; do not assume perpetual free availability. [Render official free-service documentation](https://render.com/docs/free).

Do not put the spike's filesystem journal on ephemeral hosting and call it durable. Do not move worker signing into an untracked serverless continuation to avoid finishing the worker. Keep the Vercel alias and public saved-proof fallback available through backend outages.

## Novelty and defensible positioning

**General spending limits are not novel.** Coinbase's own Agentic Wallets product describes per-session and per-transaction caps and isolates keys from the model; its current developer overview describes tools for agents to pay for x402 services. This directly undercuts a pitch that AegisPay invented bounded agent wallets or agent-paid APIs. [Coinbase Agentic Wallets product](https://www.coinbase.com/en-ca/developer-platform/products/agentic-wallets), [Coinbase developer overview](https://docs.cdp.coinbase.com/agentic-wallet/welcome).

Google's official protocol guide also describes AP2 mandates with approved merchants, expiry/guardrails, payment intent bound to a particular cart/amount and a closing receipt. Authorization/audit trails are therefore not unique categories either. This comparison establishes prior art in those concepts; it is not a claim these competing implementations were independently audited or behave identically to AegisPay. [Google developer protocol guide, AP2 section](https://developers.googleblog.com/developers-guide-to-ai-agent-protocols/).

The defensible technical contribution is **a concrete composition and demonstration**: the same Noir authorization runs through Velo sponsorship/submission; successful provider identity is matched to independent inner/outer envelope, invocation, signature and event evidence; application resource access is withheld until that evidence is attached to one immutable purchase; uncertainty preserves identity and budget instead of creating another handoff. The integration verifier and spike journal are implemented. The full paid-resource/recovery behavior is still a build target, so present it as such until its gates pass.

Useful demo positioning after completion: “AegisPay lets an agent buy a bounded API report, and keeps a lost payment response from becoming a second charge or premature data access.” Demonstrate that sentence. Do not call it a new payment standard, AP2/x402 implementation, zero-knowledge proof system or independently trustless merchant network. Its protocol is explicitly proprietary **`aegispay-402/1`**; two offers share an application/merchant boundary, and the PRD excludes a generalized daily policy.

## Safe statements versus unsupported pitch claims

| Safe now | Unsupported now / evidence needed |
|---|---|
| “AegisPay was named Top 15 in the organizer email we received.” | Guaranteed win, independently verified judging score/date/venue |
| “We recorded one real Testnet Noir authorization sponsored/submitted through Velo and a separate merchant claim.” | Two purchases, a new payment on every replay, or a completed model purchase |
| “We matched the saved provider identity to independent transaction/invocation/event evidence.” | A current verifier rerun merely because the public page or explorer loads |
| “The real contract simulation rejected an over-cap amount before signing/submission.” | Included failed transaction, paid failed charge, proof of expired-policy refusal |
| “The main branch contains PostgreSQL quote/budget/nonce/evidence guards and private auth/wallet APIs.” | Those routes are live on the submitted site or the whole app has recovery acceptance |
| “Today the public site presents saved evidence.” | Live model dashboard, fresh current policy, current chain/worker/model health |
| “Gemini completed a harmless tool round trip in the saved checkpoint.” | Gemini chose, paid for and consumed a report; price-sensitive purchasing proof |
| “Current offline checks passed 73 unit and 50 synthetic spike tests.” | Current 46 DB integration, browser E2E, production build or release gate passed |
| “Authorization credited merchant-pending escrow; claim was separate.” | Authorization immediately paid the merchant wallet, or every claim maps one-to-one to a purchase |
| “Application controls reserve a run budget; contract policy limits individual permitted authorizations.” | All cumulative spend/merchant/resource limits enforced on-chain, compromised-key proof, audited production security |
| “Report content and prices are fictional demonstration fixtures.” | Real security intelligence, validated savings, customers/revenue/market demand |

## Rubric-aligned technical checklist

Rubric provenance is the user-supplied Nov 5 Builder Handbook, SHA256 `ac77495fd5512dc2d62924dbbe9d6fed6b18ea1b64d72a99c010e8a1ba0cd55b`, recorded in [research](../research.md#builder-handbook-reconciliation--2026-11-07), [context](../../context.md) and [QA](../qa-test-plan.md). It assigns **agentic fit 30%, technical execution 25%, innovation 20%, real-world potential 15%, pitch/demo 10%**. This report applies those weights; it invents no judge score or win probability.

| Criterion | Current evidence | Concrete finals acceptance |
|---|---|---|
| **Agentic fit — 30%** | Adapter connectivity and mock guard tests; real purchasing loop absent | Real task → both current offers → model-chosen quote → bounded purchase → authorized report → concise receipt-cited answer. Separate changed-price and unnecessary-data/no-purchase rehearsals with actual tool traces |
| **Technical execution — 25%** | Strong one-payment SDK evidence and offline regressions; DB/auth foundations; incomplete app | Current type/lint/unit/DB/E2E/build plus two distinct live successes, over-cap and expired-policy refusals, real wallet claim/lifecycle, duplicate and crash checks, hosted origin/auth/ownership/fixture leakage checks |
| **Innovation — 20%** | Same-transaction integration and rigorous independent verifier; generic cap story weak | Show the uncertain-response boundary and one-grant recovery working. Explain app-side resource binding and contract-side policy honestly; credit Noir/Velo and prior art |
| **Real-world potential — 15%** | Specific paid-report concept, fictional fixtures, no demand validation | Explain one credible API-buying user/problem, why autonomous payment matters, merchant fulfillment responsibility and realistic operating constraints. Avoid pretending demo prices establish business economics |
| **Pitch/demo — 10%** | Honest live saved-proof viewer and preserved media; no full live journey | A five-minute rehearsed flow readable at 1280×720, explicit live/historical labels, minimal scrolling, stable submitted links and a fallback that is announced as replay |

Mandatory handbook technical items: Testnet only **observed in guards/evidence**; deployed Noir SDK use **historically proved**; actual Velo SDK use **historically proved** with organizer-specific Gas interpretation not independently resolved here; root workspaces/public source **present**; hosted public site **present as proof-only slice**; agent actually chooses/requests/makes the application purchase **not established**. Top-15 selection does not silently complete the missing item.

## Concrete live-demo acceptance and five-minute rehearsal

These are acceptance targets for later authorized implementation/rehearsal, not actions executed by this assessment. Preserve all ten PRD invariants. The application should complete the happy-path purchase comfortably inside a **90-second active agent window**; do not start that window while waiting for cold-host wake. Measure actual wall time separately.

### Pre-stage before entering the room

- Deploy one tested commit at the same submitted website URL, with working `/app`, Node API routes, healthy authenticated worker ingress and migrated/seeded PostgreSQL. Record deployment/build identity and redacted dependency readiness. Keep saved-proof mode accessible without backend secrets.
- Confirm current Testnet network/native SAC/mandatory October 24 contract tuple independently; no custom redeploy. Have owner/merchant Freighter wallets installed, distinct configured addresses, Testnet selected, login sessions usable and actual consent rehearsal completed.
- Verify finite policy still valid through the session, sufficient escrow, Velo project/relayer enabled and Gemini model/quota available. Never infer current readiness from the Nov 7 snapshot. Ensure persistent nonce continuity or a deliberately separate fixture/identity.
- Complete QA's two **distinct** sponsored successes and store redacted quote/attempt/reservation/inner/outer/event/ledger records plus refusals and claim evidence. Repeated reads of either purchase do not create another count.
- Rehearse changed offer prices within policy bounds and a task requiring no paid data; demonstrate actual model behavior rather than a scripted always-buy. Record only concise stated rationale and safe tool results, not private reasoning/provider signatures.
- Rehearse true lost-response/restart behavior after the handoff boundary: same operation/request/nonce/hash; zero new sign/sponsor/submit calls after restart; no report until both evidence sources match; exactly one grant and spend. If evidence remains unknown, keep it unknown with budget held. Distinguish this controlled failure from a genuinely live provider outage.
- Run 50 independent-connection duplicate accept/recovery cases, wrong-owner/resource/receipt/window tests, original quote after price edit, expired quote before handoff and timely handoff with late confirmation. Verify fixture sentinels and secrets absent from HTML/RSC/JS/unauthorized responses/errors/traces. Browser mocks supplement, never replace, the separately recorded real journey.
- Test actual role login → wallet setup → funding → model run → merchant claim → revoke → reclaim. Check no new device removal can strand escrow. Test included failure and pre-send crash behavior without unsafe retry controls.
- Warm the real backend, check free-DB expiry, present at 1280×720, verify mobile wrapping on production, and keep the actual submitted deck/video accessible. A paid report fixture remains labeled fictional.

### Five-minute stage sequence

| Time | Demonstration | Pass condition |
|---|---|---|
| **0:00–0:35** | One user problem and task: agent needs a bounded report purchase, owner sets authority | Audience understands buyer, paid resource, cap and merchant; correct live/historical mode visible |
| **0:35–1:05** | Show current confirmed policy/escrow and two priced demo offers | Current observed timestamps/units, finite expiry; no secrets or owner approvals hidden as agent autonomy |
| **1:05–2:25** | Submit task once; show genuine model tool steps and quote/attempt progression | One stable quote/operation; server-controlled integer terms; budget held; Velo reservation persisted before handoff |
| **2:25–3:10** | Show independently verified receipt and purchased fictional report/answer | Velo succeeded **and** matching Noir signature/invocation/event; one entitlement, one spend; inner/outer roles clear |
| **3:10–3:45** | Show refusal and reload/recovery proof | Over-cap refusal correctly labeled local versus real unsigned simulation; replay/unknown does not dispatch again or reveal data. Use a clearly labeled rehearsal trace if a live failure would jeopardize timing |
| **3:45–4:20** | Show separate merchant pending → wallet claim | Merchant consent and distinct claim hash/state; no second entitlement; sufficient current pending funds if claiming live |
| **4:20–5:00** | Explain differentiated boundary, limitations, user and next step | Confidently answer why limits alone are not new; no production/security/market promises beyond evidence |

If a dependency fails, do not click another purchase or reset anything. Preserve the unresolved attempt, show its durable identity, announce “switching to the recorded Testnet proof,” and use the existing fallback/video. That yields an honest technical presentation; it does not retroactively pass the full live-MVP release gate.

The most valuable three-minute Q&A answers to rehearse are: **what stops a prompt from becoming signing authority; why Velo success or a Noir event alone is insufficient; how restart avoids a second handoff; what is contract-enforced versus application-enforced; why authorization and claim differ; and what the saved spike does not prove.**
