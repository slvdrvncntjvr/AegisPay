# AegisPay pitch and demo runbook

**Status:** draft rehearsal sources, not a claim of a completed app demo. Supplied handbook rubric/format are recorded in [context](../context.md); deadline passed, no extension supplied. One SDK payment is proved; model app/deployment/public media are unfinished. Method: FMD pitch playbook (local preparation reference).

## 1. Business narrative

APIs that agents can buy from, with spending rules outside their prompts. AegisPay is a Testnet experiment for agent developers: the model chooses useful demo data, Noir constrains escrow authorization, Velo sponsors the signed call, and the gateway verifies payment before returning the report. The demo tests one reliable purchasing workflow. Customer demand and a sustainable fee model remain hypotheses.

Do not use past-tense success language until [QA release gates](qa-test-plan.md) and saved live artifacts support it.

## 2. Business Model Canvas

| Block | Content | Pitch beat |
|-------|---------|------------|
| Value proposition | Autonomous request purchase with observable limits and fulfillment | Problem/demo |
| Customer segments | Small agent teams and specialized API owners; no validated customer base | Problem |
| Why this project | A narrow Noir/Velo integration and honest recovery workflow; no asserted protocol moat | Wedge |
| Key partners | Noir, Velo, Stellar and model API are technical dependencies, not claimed partnerships | Technology |
| Key activities | Correct authorization, evidence mapping and delivery | Demo |
| Key resources | Working adapter, invariants and inspectable transaction evidence once built | Proof |
| Cost structure | Model calls, DB/worker hosting, RPC and sponsored chain fees; unbenchmarked | Model |
| Revenue streams | Potential provider gateway subscription/usage fee; unvalidated, no real charging in MVP | Model |
| Channels | Hackathon demo and subsequent direct developer pilots | Ask |
| Customer relationships | Hands-on test integrations and behavior-based feedback after demo | Ask |

## 3. Timed script and operational runbook

The handbook requires a **two-minute video**, a **five-minute pitch with live demo**, then **three-minute Q&A**. The form's reported five-minute video maximum does not relax the stricter two-minute target. Use [the complete recording script](submission/recording-script.md) and [eight-slide deck source](submission/pitch-deck.md). Neither is recorded/exported/published yet. [Submission packet](submission/README.md) tracks actual links and a draft short write-up.

**Before recording/presenting:** pass TASK-010/TASK-012 gates; verify mandatory Testnet tuple, current policy/escrow, model access, sponsor health, authenticated ownership and public URL. Open actual Policy/Run/Audit, explorer and redacted proof. Label fixture reports and saved recordings; no fabricated product screenshot. TASK-002 review fixes, real workspaces and full model app are still unfinished. Current proof cannot be narrated as a completed model purchase.

| Video time | Beat | Evidence required |
|------------|------|-------------------|
| 0–12s | Problem and owner limits | Actual policy/Testnet state |
| 12–27s | Cap, escrow and two current offers | Confirmed policy and trusted catalog |
| 27–47s | Genuine model choice and 402 quote | Actual model tools/reason and immutable quote |
| 47–72s | Noir prepare / Velo sponsor-submit-status | Real timeline; keep pending unresolved |
| 72–91s | Independent proof and protected resource | Matched invocation/envelope/event plus receipt; no event-only fulfillment |
| 91–107s | Refusal and wrong-resource denial | Label actual contract simulation vs included transaction |
| 107–120s | Pending vs separate claim, public links/ask | Separate claim proof; verified URLs only |

Allow actual pending time; disclose edits/wait intervals. Network fallback is a labeled recording of an actual earlier run with timestamp/matching proof. If only the current integration exists, use source/artifact/explorer views and say model app/deployment are incomplete; it is not a substitute for the working website. Never force a state to fit the timer.

**Five-minute live pitch:** slide 1 problem/boundary 0:00–0:25; slide 2 workflow/users 0:25–0:55; slide 3 live demo 0:55–2:10; slide 4 architecture 2:10–2:50; slide 5 verified proof 2:50–3:25; slide 6 recovery 3:25–4:00; slide 7 pilot/economics hypotheses 4:00–4:30; slide 8 status/ask 4:30–5:00. Then Q&A until 8:00. Salvador Vincent Javier owns every beat; no fictional teammate.

| Official criterion | Weight | Pitch evidence / honest gap |
|--------------------|--------|-----------------------------|
| Agentic payments fit | 30% | Real model decides/request payment; current SDK spike alone does not prove this |
| Technical execution | 25% | Same-transaction Noir/Velo proof, invariants, deployed app; remaining gates explicit |
| Innovation | 20% | Agent purchase plus inspectable constrained authorization; no unsupported novelty/moat claim |
| Real-world potential | 15% | Specific developer/API-provider pilot; demand and sustainable pricing unvalidated |
| Pitch and demo | 10% | Clear two-minute recording, five-minute live pitch, linked proof and honest fallback |

## 4. Q&A ownership map

Salvador Vincent Javier is the single presenter/owner for product, technical demo and business questions; there are no fictional speakers.

| Question | Owner | Answer |
|----------|-------|--------|
| Is the data real? | Vincent | Reports are demo fixtures; payment evidence is real only when linked to successful Testnet records |
| Is this x402 compliant? | Vincent | HTTP 402-inspired proprietary adapter; no v2 conformance claim |
| How do both SDKs matter? | Vincent | Noir policy/escrow preparation; Velo sponsors/submits that same authorization; independent RPC proof gates access |
| Does this guarantee a daily budget? | Vincent | Noir enforces per-payment cap/expiry and finite escrow; app enforces this run's ceiling |
| Is a URL bound on-chain? | Vincent | No; gateway binds quote/resource to parsed signed operation in its DB |
| Has the merchant received spendable funds? | Vincent | Authorization credits pending escrow; merchant claim is a separately signed transaction |
| Why not prepaid keys? | Vincent | They may be preferable; this tests wallet-based agent purchasing ergonomics, not proven superiority |
| What if it times out? | Vincent | Retain saved identity and reconcile; no report or second automatic charge |
| Who pays and is it sustainable? | Vincent | A provider service fee is a hypothesis; real cost/margin/customer validation is pending |
| Does it satisfy the hackathon? | Vincent | Mandatory October 24 IDs match proof; actual Velo role is Gas. Workspaces/app/hosting/public media remain unfinished; organizer Gas interpretation, registration and late acceptance are unconfirmed. No eligibility promise |

## 5. Interview probe sheet

After the hackathon, test whether wallet-native per-request purchasing solves a recurring problem for agent developers/API owners. Do not delay the build for invented validation.

1. Show the last agent workflow that needed a new paid API. Where did account/billing setup block it?
2. What did you do, pay or build to get past that block?
3. Show a recent overspend or failed fulfillment and its operational cost.
4. Why did current API keys/prepaid credits fail, if they did?
5. Would you supply a real endpoint or run for a small integration pilot?

No interviews have been performed here. Log observed past behavior and actual commitments separately from opinions. No testimonial or demand statistic is fabricated.
