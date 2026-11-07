# AegisPay — eight-slide pitch deck source

**Draft, 2026-11-07.** Presenter: Salvador Vincent Javier, solo (Discord unconfirmed). Five minutes including live demo, then three minutes Q&A. This is source, not a public Slides/Canva/PDF link. App/model/DB/UI/workspaces/deployment are unfinished. No fake screenshots. Export/publish after claims are updated from real gates.

---

## Slide 1 — Agents need useful data, and owners need limits

**On slide:** AegisPay — bounded API purchasing on Stellar Testnet. Agent chooses; deterministic tools check; Noir limits; Velo executes.

**Say, 0:00–0:25 (25s):** “We are exploring a narrow problem for agent developers: buying a useful report during a task while preserving spending control and a reliable receipt. Today's verified result is one SDK authorization and separate claim. The complete model app is still being built.” Update that last sentence only with release evidence.

**Visual:** four labeled boxes/arrows, no product screenshot.

---

## Slide 2 — One workflow worth testing

**On slide:** Developer needs data → current price → bounded purchase → verified resource access. Target: small agent teams and specialized API owners. Demand is a hypothesis.

**Say, 0:25–0:55 (30s):** “Prepaid keys can work well. We want to learn whether wallet-based, per-request purchasing helps agents choose a new resource without open-ended signing authority. We have no customer or revenue traction claim.”

**Visual:** intended task/quote/receipt sequence.

---

## Slide 3 — Live workflow: choose, request, verify

**On slide:** QuickSignal 300000 stroops; DeepTrace 1200000; cap 1000000. Fixture reports; real Testnet payment. Show actual model choice/402 quote, not a manually selected payment.

**Demo, 0:55–2:10 (75s):** After gates pass, open the real hosted app; show confirmed policy, enter task, show tool choice/quote and follow pending to verified receipt/resource. Keep pending honest. If unfinished, present saved integration artifact/explorer, explicitly saying it is an SDK spike, not an autonomous model purchase. Backup video must be labeled and from a real run.

**Visual:** actual app only when available; otherwise actual redacted evidence. [Recording source](recording-script.md).

---

## Slide 4 — Two SDKs, one authorization

**On slide:** apps/web → PostgreSQL ← private apps/server. packages/agent = model/tool loop; packages/shared = real schemas. Noir 0.3.0 prepares mandatory deployed escrow call; Velo 1.0.0 Gas sponsors/submits/observes; independent RPC verifies.

**Say, 2:10–2:50 (40s):** “The owner configures the mandatory October 24 Noir contracts. Server signs one authorization, persists Velo identity before dispatch and separately verifies invocation and event. Workspace components are targets until TASK-011; spike source stays stable. Gas is our actual Velo role; organizer-specific approval remains unconfirmed.”

**Visual:** root README architecture, with unbuilt components marked.

---

## Slide 5 — What the chain proves today

**On slide:** One authorization: 300000 stroops = 0.03 Testnet XLM. Inner 1d39c3e3…; outer/event 6e898ad8…. Escrow 10000000 → 9700000. Pending 0 → 300000 → 0 after separate claim 94cea8bb…. Two reports = one payment.

**Say, 2:50–3:25 (35s):** “Saved proof matches Velo execution to successful Stellar envelope, invocation and Noir event. Authorization and claim are separate. Over-cap refusal is deployed-contract simulation, not an included failed transaction. We make no fee or latency claim while review fixes are pending.”

**Visual:** [full report/transaction links](../../README.md#testnet-proof); no fabricated second run or completion checkmark.

---

## Slide 6 — Recovery belongs in the payment boundary

**On slide:** Immutable quote; persisted nonce; one handoff; unknown means no data; owner/resource receipt binding. Model intent is untrusted.

**Say, 3:25–4:00 (35s):** “We preserve identity through uncertainty rather than signing again. The event alone lacks asset and agent, so it cannot authorize a report. Planned PostgreSQL constraints and negative tests must establish one entitlement and correct ownership. The spike does not prove those database races are solved.”

**Visual:** accepted → pending/unknown → independently verified → entitled; no unknown-to-data edge.

---

## Slide 7 — A focused route to real use

**On slide:** Pilot: one agent developer + one paid API provider. Measure integration friction, denied/recovered purchases, delivery correctness and actual costs. Potential gateway subscription/usage fee is unvalidated.

**Say, 4:00–4:30 (30s):** “Next commercial step is a small developer pilot, not a market-size claim. Model, hosting, RPC and sponsored fees need measurement. We want evidence of a recurring purchasing problem before claiming demand or sustainable margins.”

**Visual:** integrate → observe → interview → decide.

---

## Slide 8 — Honest progress, concrete next gates

**On slide:** Proved: one Velo-sponsored Noir authorization and separate claim. Next: review fixes → workspaces → DB/model/UI release → public app → public video/deck. Repo: https://github.com/slvdrvncntjvr/AegisPay. App/video/deck URLs: unpublished. Ask: pilot feedback, Gas/late-acceptance clarification.

**Say, 4:30–5:00 (30s):** “Testnet integration is real; the complete hosted application is unfinished. We are keeping those limits visible. The handbook deadline has passed with no extension or eligibility assurance. We want feedback on the purchasing workflow and unresolved event interpretation.”

**Visual:** factual progress list; replace statuses/URLs only with verified results.

---

## Three-minute Q&A preparation

Salvador Vincent Javier answers all questions. Prepare: why Gas rather than checkout (actual role, no organizer approval); unknown recovery (saved identity/one handoff); event insufficiency (missing asset/agent); fixture content; no x402 conformance claim; pending funds vs claim; whether model chose current spike (no); remaining review fixes/app/workspaces/hosting/public media. [Pitch kit](../pitch-kit.md) owns full answer map.
