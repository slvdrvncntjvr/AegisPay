# AegisPay pitch and demo runbook

**Status:** rehearsal script, not claims that the demo has run. Official event rubric/format remains in [context](../context.md); unknown weights are not invented. Method: [FMD pitch playbook](../fmd/playbooks/pitch-deck-playbook.md).

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

Prepare the brief's short demo; expand only if the official format requires it. No rubric mapping is claimed while official criteria are unavailable.

**Before recording/presenting:** run required QA gates, verify network/contracts and sponsor health, have a finite funded agent ready, preserve valid policy expiry, and open Run/Audit. Prerecorded setup is labeled; funded state must be real. Retain cap/claim/replay evidence for Q&A. Report data is visibly fictional.

| Time | Beat | Action / words |
|------|------|----------------|
| 0–15s | Problem and boundary | “This agent can buy data within a preapproved Testnet cap.” Show actual policy/escrow/expiry and both offers |
| 15–35s | Genuine choice | Start task; show catalog tools, choice and actual 402 quote |
| 35–55s | Payment proof | Show Noir preparation, Velo sponsored submission and observed independent evidence; if still pending, say so |
| 55–70s | Fulfillment | Show the resource-specific report and receipt with inner/outer hash; authorization and merchant claim remain separate |
| 70–80s | Refusal | Show recorded or freshly run isolated live over-cap contract refusal, labeled by actual simulation/ledger evidence type |
| 80–90s | Replay and close | Show wrong-resource denial, then ask for developer pilots; use measured fee/latency only if available |

If settlement takes longer, allow the run to finish and shorten narration; never force the state or hide a failure to fit the script. If network fails, show a visibly labeled recording of an actual earlier Testnet run with timestamp and linked saved proof. If no real successful run exists, present an incomplete integration honestly, not a live payment demo. Never display secrets while switching terminals.

**Longer pitch:** problem → live workflow → policy/claim/context-binding limits → developer pilot hypothesis → ask. N/A five-minute rubric-weighted script: official time/rubric unavailable; adapt from verified event facts, not assumed weights.

## 4. Q&A ownership map

Vincent is the single presenter/owner for product, technical demo and business questions; there are no fictional speakers.

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
| Does it satisfy the hackathon? | Vincent | Both SDK paths are designed in; Gas Station eligibility must be checked against official rules before claiming qualification |

## 5. Interview probe sheet

After the hackathon, test whether wallet-native per-request purchasing solves a recurring problem for agent developers/API owners. Do not delay the build for invented validation.

1. Show the last agent workflow that needed a new paid API. Where did account/billing setup block it?
2. What did you do, pay or build to get past that block?
3. Show a recent overspend or failed fulfillment and its operational cost.
4. Why did current API keys/prepaid credits fail, if they did?
5. Would you supply a real endpoint or run for a small integration pilot?

No interviews have been performed here. Log observed past behavior and actual commitments separately from opinions. No testimonial or demand statistic is fabricated.
