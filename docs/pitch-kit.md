<a id="aegispay-pitch-and-demo-runbook"></a>

# AegisPay pitch and presentation runbook

**Status:** current presentation sources for the delivered Testnet application. Supplied handbook rubric/format are recorded in [context](../context.md); deadline passed, no extension supplied. Nov7 integration proof is separate from the verified Nov14 Gemini purchase/report, Nov15Manila merchant claim and hosted handoff; broader production qualification remains deferred. Method: FMD pitch playbook (local preparation reference).

## 1. Business narrative

APIs that agents can buy from, with spending rules outside their prompts. AegisPay supports bounded Testnet payments for agent developers: the model chooses useful fictional data, Noir constrains escrow authorization, Velo sponsors the signed call, and the gateway verifies payment before returning the report. The application preserves a verified purchasing workflow. Customer demand and a sustainable fee model remain hypotheses.

Scope success to the dated [purchase/report](evidence/first-app-purchase-2026-11-14/report.md), [separate claim](evidence/merchant-claim-2026-11-14/report.md) and [hosted handoff](demo-handoff.md); [QA release gates](qa-test-plan.md) retain broader deferred obligations.

## 2. Business Model Canvas

| Block | Content | Pitch beat |
|-------|---------|------------|
| Value proposition | Autonomous request purchase with observable limits and fulfillment | Problem / workflow |
| Customer segments | Small agent teams and specialized API owners; no validated customer base | Problem |
| Why this project | A narrow Noir/Velo integration and honest recovery workflow; no asserted protocol moat | Wedge |
| Key partners | Noir, Velo, Stellar and model API are technical dependencies, not claimed partnerships | Technology |
| Key activities | Correct authorization, evidence mapping and delivery | Workflow |
| Key resources | Working adapter, invariants and inspectable transaction evidence once built | Proof |
| Cost structure | Model calls, DB/worker hosting, RPC and sponsored chain fees; unbenchmarked | Model |
| Revenue streams | Potential provider gateway subscription/usage fee; unvalidated, no real-money charging on Testnet | Model |
| Channels | Hackathon presentation and subsequent direct developer pilots | Ask |
| Customer relationships | Hands-on test integrations and behavior-based feedback after presentation | Ask |

## 3. Timed script and operational runbook

The handbook requires a **two-minute video**, a **five-minute pitch with live demo**, then **three-minute Q&A**. The form's reported five-minute video maximum does not relax the stricter two-minute target. Use [the complete recording script](submission/recording-script.md) and [eight-slide deck source](submission/pitch-deck.md). An evidence-replay video and refreshed eight-slide PDF are already published; the complete actual model-purchase recording remains outstanding. [Submission packet](submission/README.md) tracks actual links and the current short write-up.

**Before presenting:** open existing hosted Policy/Run/Audit history, explorer and redacted evidence with Testnet and fictional-report labels visible. The original policy and report window have expired: inspect receipt metadata, not a renewed report. No new task, purchase, signature or claim is needed to present saved history. A future purchase requires fresh policy and task consent. Broader TASK-010/TASK-012 gates remain deferred. The recording sequence below is a future capture plan, not authority for financial actions.

| Video time | Beat | Evidence required |
|------------|------|-------------------|
| 0–12s | Problem and owner limits | Actual policy/Testnet state |
| 12–27s | Cap, escrow and two current offers | Confirmed policy and trusted catalog |
| 27–47s | Genuine model choice and 402 quote | Actual model tools/reason and immutable quote |
| 47–72s | Noir prepare / Velo sponsor-submit-status | Real timeline; keep pending unresolved |
| 72–91s | Independent proof and protected resource | Matched invocation/envelope/event plus receipt; no event-only fulfillment |
| 91–107s | Refusal and wrong-resource denial | Label actual contract simulation vs included transaction |
| 107–120s | Pending vs separate claim, public links/ask | Separate claim proof; verified URLs only |

Allow actual pending time; disclose edits/wait intervals. Network fallback is a labeled recording of an actual earlier run with timestamp/matching proof. Use dated Nov14 application evidence and existing hosted history, while keeping the Nov7 integration replay separate; do not imply the expired report is readable. Never force a state to fit the timer.

**Five-minute live pitch:** slide 1 problem/boundary 0:00–0:25; slide 2 workflow/users 0:25–0:55; slide 3 recorded application evidence 0:55–2:10; slide 4 architecture 2:10–2:50; slide 5 verified proof 2:50–3:25; slide 6 recovery 3:25–4:00; slide 7 pilot/economics hypotheses 4:00–4:30; slide 8 status/ask 4:30–5:00. Then Q&A until 8:00. Salvador Vincent Javier owns every beat; no fictional teammate.

| Official criterion | Weight | Pitch evidence / honest gap |
|--------------------|--------|-----------------------------|
| Agentic payments fit | 30% | Nov14 Gemini choice/purchase/report; Nov7 SDK proof alone is separate |
| Technical execution | 25% | Same-transaction Noir/Velo proof, invariants, deployed app; remaining gates explicit |
| Innovation | 20% | Agent purchase plus inspectable constrained authorization; no unsupported novelty/moat claim |
| Real-world potential | 15% | Specific developer/API-provider pilot; demand and sustainable pricing unvalidated |
| Pitch and demo | 10% | Clear two-minute recording, five-minute live pitch, linked proof and honest fallback |

## 4. Q&A ownership map

Salvador Vincent Javier is the single presenter/owner for product, technical workflow and business questions; there are no fictional speakers.

| Question | Owner | Answer |
|----------|-------|--------|
| Is the data real? | Vincent | Reports are fictional fixtures; payment evidence is real only when linked to successful Testnet records |
| Is this x402 compliant? | Vincent | HTTP 402-inspired proprietary adapter; no v2 conformance claim |
| How do both SDKs matter? | Vincent | Noir policy/escrow preparation; Velo sponsors/submits that same authorization; independent RPC proof gates access |
| Does this guarantee a daily budget? | Vincent | Noir enforces per-payment cap/expiry and finite escrow; app enforces this run's ceiling |
| Is a URL bound on-chain? | Vincent | No; gateway binds quote/resource to parsed signed operation in its DB |
| Has the merchant received spendable funds? | Vincent | Authorization credits pending escrow; merchant claim is a separately signed transaction |
| Why not prepaid keys? | Vincent | They may be preferable; this tests wallet-based agent purchasing ergonomics, not proven superiority |
| What if it times out? | Vincent | Retain saved identity and reconcile; no report or second automatic charge |
| Who pays and is it sustainable? | Vincent | A provider service fee is a hypothesis; real cost/margin/customer validation is pending |
| Does it satisfy the hackathon? | Vincent | Mandatory October 24 IDs match proof; actual Velo role is Gas. The hosted Testnet application preserves the verified model purchase/report and separate merchant claim; broader production/live qualification remains deferred; organizer Gas interpretation, registration and late acceptance are unconfirmed. No eligibility promise |

## 5. Interview probe sheet

After the hackathon, test whether wallet-native per-request purchasing solves a recurring problem for agent developers/API owners. Do not delay the build for invented validation.

1. Show the last agent workflow that needed a new paid API. Where did account/billing setup block it?
2. What did you do, pay or build to get past that block?
3. Show a recent overspend or failed fulfillment and its operational cost.
4. Why did current API keys/prepaid credits fail, if they did?
5. Would you supply a real endpoint or run for a small integration pilot?

No interviews have been performed here. Log observed past behavior and actual commitments separately from opinions. No testimonial or demand statistic is fabricated.
