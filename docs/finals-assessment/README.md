# AegisPay finals assessment and recommended priorities

Assessed 9 November 2026 against main `180a88d`, the actual submitted website and PDF, preserved implementation/media, current primary sources and the supplied Top 15 email. Prepared through three user-authorized Orca reviews, reconciled by the coordinator. This packet is an assessment and proposed direction. It does not replace the implementation plan or establish a completed application release.

**Verdict: AegisPay is pitchable and has credible technical proof. The current product demonstration needs substantial completion to make the strongest finals case.** The best use of effort is a narrow, useful, independently verifiable agent purchase with understandable refusal and recovery. Visual polish should make that behavior easy to see. A new architecture, rebrand or broader marketplace would consume time without resolving the central gap.

The supplied November 8 organizer email says Top 15, with finals date and venue TBA. That is the current user-supplied finals context. Historical public event schedules conflict with the older handbook; neither supplies a newer confirmed finals date. No score or winning probability is inferred.

## Evidence packet

| Report | What was inspected | Main conclusion |
|---|---|---|
| [Technical assessment](technical-audit.md) | Implemented source, preserved unfinished Git objects, production GETs, current offline checks | Strong same-authorization SDK proof and substantive DB/auth foundations; durable application worker and full model purchase remain unfinished |
| [UI assessment](ui-audit.md) | Actual desktop, 1280×720 and 390px production views, safe interactions, keyboard behavior, screenshots and primary product references | Honest saved-proof viewer; weak task/outcome hierarchy, confirmed mobile overflow and excessive technical detail for projection |
| [Pitch strategy](pitch-strategy.md) | All eight actual PDF pages, public raw-PDF byte comparison, local video metadata/two frames, organizer and competitor research | Coherent deck design with stale progress copy; specific user problem and a complete purchase demonstration are needed |

The coordinator read all reports and inspected production desktop/mobile and deck screenshots. Detailed reports distinguish observed, historical, inferred and unverified findings. No reviewer signed, paid, published, uploaded, changed deployed content or contacted organizers.

## Preserve the existing submission identity

| Item | Existing destination | Required handling |
|---|---|---|
| Name | **AegisPay** | Preserve |
| Website | https://aegispay-live.vercel.app/ | Update tested content at this exact alias; retain a clearly dated saved-proof fallback |
| Pitch | https://github.com/slvdrvncntjvr/AegisPay/blob/main/docs/submission/AegisPay-pitch-draft.pdf | Refresh the PDF at this exact repository path; the word `draft` in the filename does not require renaming |
| Repository | https://github.com/slvdrvncntjvr/AegisPay | Preserve name/history and existing proof identities |
| Recovered submitted video folder | https://drive.google.com/drive/folders/1hqwzOaG_qU9axjcLIjBUb1YeMWdOFq72?usp=sharing | Preserve folder and existing media; verify uploaded content and anonymous playback before declaring a replacement available |

The raw public PDF returned 200 and matched the local eight-page file exactly. The GitHub viewer had transient retrieval failures in one review. The website and health endpoint returned 200. Current Drive folder contents and video playback were not established: the existing MKV is a historical observation, while the inspected 112-second MP4 is a local saved-proof replay whose new upload remains unproved. A folder shell returning 200 is not playback verification.

## Actual readiness

| Surface | Established | Still missing |
|---|---|---|
| Payment | One historical 0.03 Testnet XLM Noir authorization sponsored/submitted through Velo; independent envelope/invocation/event mapping; separate merchant claim | Two distinct application purchases and complete current release evidence |
| Refusal | Actual unsigned contract simulation rejected 0.12 against a 0.10 per-payment cap | Complete application refusal and other required current lifecycle cases |
| Data/auth | Implemented PostgreSQL immutable quote, budget, nonce and evidence guards; private session/wallet APIs | Running end-to-end merchant receipt/report path and deployed authenticated application |
| Agent | Gemini adapter, strict tools and a historical non-financial tool round trip | Durable discover → choose → quote → buy → wait → read → answer loop |
| Worker | SDK spike has conservative persistent handoff protection; unfinished application source is preserved | Reviewed active application executor, restart/lease handling and hosted integration |
| UI | Public saved-proof tabs and real public link | Usable task, wallet/policy, merchant and receipt flows; production login/state routes currently return 404 |
| Pitch | Existing eight-page PDF with coherent design | Accurate current status, specific user task, real product demonstration and matched notes/README/video |

Current root/web typechecks, lint, **73 unit tests**, **50 offline spike tests** and both documentation checks passed. The 46 PostgreSQL tests and production build are historical checkpoint evidence, not reruns in this assessment. Current full browser/wallet/model/Testnet release gates were not performed. Reopening old explorer links does not create another purchase or a fresh independent-verifier pass.

The historical policy expired November 7. A new live run needs current finite policy/escrow and verified identity/nonce continuity. A fresh database starting at nonce zero must not accidentally reuse a historical signed nonce. Historical records must remain unchanged.

## What makes the strongest case

The supplied handbook weights agentic fit **30%**, technical execution **25%**, innovation **20%**, real-world potential **15%**, pitch/demo **10%**. The first two account for 55%; finishing behavior deserves most engineering attention.

The strongest proposed user is a developer building an assistant that occasionally needs a specialized paid-data endpoint. The supplier is a specialist report/API provider. Both are customer hypotheses. Use the existing fictional dependency-triage fixtures to make the task concrete without inventing a real security-intelligence product.

Proposed demo task: “Review the fictional demo-parser dependency for a basic release triage note. Buy only the information needed, within 0.10 Testnet XLM, and state what the report cannot establish.” Free metadata must not already contain the paid answer. The final answer should visibly benefit from the purchased report and cite its actual receipt.

The intended offers are QuickSignal at 0.03 and DeepTrace at 0.12 Testnet XLM. An affordable/forbidden pair illustrates a cap, but does not alone establish intelligent choice. Also rehearse changed prices within permitted bounds and a task where no paid data is needed. The model should respond to real trusted inputs rather than always purchasing a hardcoded offer. The old spike must never be retrospectively described as a QuickSignal purchase: it did not establish that resource, quote, model choice or delivery.

Spending limits, key isolation and paid API access have prior art. [Coinbase documents agent wallets and x402 purchasing](https://docs.cdp.coinbase.com/agentic-wallet/welcome); [Stripe documents programmatic pay-per-call](https://docs.stripe.com/payments/machine) and [scoped agent payment credentials](https://stripe.com/blog/giving-agents-the-ability-to-pay). These vendor descriptions do not establish competitor audit results, but they rule out a credible invention claim for the category.

The defensible contribution is the concrete composition: **the same Noir authorization through Velo, independently matched evidence, and a resource-specific application purchase designed to retain its identity through uncertainty.** The integration half is proved; full fulfillment/recovery must earn its claim through completion and tests. The application has no demonstrated on-chain resource binding or generalized cumulative budget. Its HTTP 402-inspired protocol has no established x402 conformance claim. Noir here is the provided wallet/agent SDK, not a demonstrated zero-knowledge proof system.

## Recommended product and website direction

Use the existing deck's dark teal, cream and mint visual language. The deck is visually stronger than the current website; preserve that useful work. Keep one compact Testnet/live-or-recorded label, clear typography and large readable amounts. Move full hashes and contract addresses into expandable receipt detail. Keep health JSON in the developer footer.

Proposed headline: **“Let agents buy useful data. Keep spending within your rules.”** In current proof mode, the primary action is **“Explore the verified proof.”** Enable a live task action only after its real backend and acceptance gates pass.

| Rules | Task and decision | Receipt and evidence |
|---|---|---|
| Current/historical mode, cap, expiry, escrow and application task ceiling | Useful task, current offers, accepted quote, concise stated rationale and tool timeline | Amount, authorization status, resource access status and separate merchant claim |
| Expandable identities and contract details | Clearly distinct allowed, denied and recovery examples | Velo result and independent verification provenance, then exact safe identifiers |

At 1280×720, show the amount, cap, decision and proof summary without hunting through tabs. On mobile, stack task → receipt → rules beneath a compact mode/cap strip. Do not compress the desktop canvas into horizontal phone scrolling.

Immediate observed fixes: production Run expands to **597px at a 390px viewport**; the wrapping repair exists locally but is not active in production. The page has no h1, tab associations/keyboard behavior need correction, and historical policy expiry needs an explicit badge. Full-width status bars and small monospace values dilute hierarchy. Human-readable links should open authorization, inner transaction, separate claim and the redacted evidence artifact. Keep unknown fees/status unknown; never offer an automatic second payment for uncertainty.

Reference patterns inspected: [Stripe](https://stripe.com/payments) for amount/action hierarchy; [Linear](https://linear.app/) for persistent context with readable activity and adjacent detail; [LangSmith](https://www.langchain.com/langsmith/observability) for inspectable operation traces. Adapt these information patterns to the actual payment state and evidence rather than copying decorative marketing effects.

## Execution order and acceptance

These are recommendations mapped to existing tasks, not new task statuses or replacement authority.

| Order | Work | Concrete finish line |
|---|---|---|
| 1 | Reconcile readiness and claim TASK-005; inspect preserved worker source selectively | TASK-004 is done, so TASK-005's blocked status needs reconciliation. No blind stash pop or merge. One actual 402 quote → durable payment → correctly gated resource slice |
| 2 | TASK-006 recovery and correctness | Duplicate calls, lost response, crash boundaries and unknown preserve identity/budget; no new financial handoff after dispatch; no access before verification; correct owner/resource/window checks |
| 3 | TASK-007 genuine model loop; TASK-008 UI after recovery interfaces stabilize | Real current-offer choice, purchased report and receipt-cited answer; changed-price and no-purchase traces; protected bodies never embedded publicly |
| 4 | TASK-009/010 wallet lifecycle and release evidence | Actual human wallet consent, claim/revoke/reclaim, two distinct successful purchases and required refusals; current integration/E2E/build/live gates and leakage checks |
| 5 | TASK-012 complete hosted application | Same website alias, tested web/API, durable PostgreSQL and authenticated separate worker; current readiness, cold-start/recovery rehearsal and no worker secrets in web |
| 6 | TASK-013 refreshed presentation and submission contents | Same PDF path, accurate site/deck/README/notes, real two-minute recording when available, verified exact-folder playback and timed stage rehearsal |

The technical review estimates **4–8 focused solo working days**, assuming external access/services cooperate. This is an estimate, not a deadline or promise. A three-day plan is aggressive scope concentration, not evidence the full gate fits. With one day, prioritize an honest technically strong proof presentation and only claim a full product if it actually passes. With a week, target the complete narrow workflow and reserve time for failure rehearsals and deployment/media verification. Cut generalized marketplace features, extra chains and elaborate motion first.

Current external readiness was not established for the final hosted worker/DB, current Velo/policy/nonce setup, Gemini quota or authenticated Drive upload. Their exact configuration names and hosting checks are in the technical report and existing environment contract. Do not request or print secret values in chat. These dependencies limit their related integrations; useful local implementation/review can continue.

## Pitch and demonstration

The complete [pitch strategy](pitch-strategy.md) includes accurate 30/90-second pitches, an eight-slide replacement blueprint, a current-state five-minute script, conditional live-demo substitutions and twenty difficult Q&A answers.

Safe short pitch today:

> AegisPay explores how an agent buys useful API data while its owner retains bounded spending authority. We have proved one real Testnet authorization through Noir and Velo, plus a separate merchant claim. We are completing the model purchase and verified report-access workflow, including recovery that preserves the purchase identity. Our first target is an agent developer and a specialist data provider testing a recurring paid-data task.

After the full gates pass, lead with the demonstrated purchase and recovery result instead of the build status. Do not claim it early.

| Stage time | Purpose |
|---|---|
| 0:00–0:45 | Specific developer problem and useful paid-data task |
| 0:45–1:50 | Current policy, real model choice and accepted quote; if unavailable, explicitly switch to saved integration mode |
| 1:50–2:30 | Same authorization through Noir/Velo and independent verification |
| 2:30–3:10 | Useful paid result and receipt; distinguish merchant-pending authorization from claim |
| 3:10–3:45 | Correctly labeled refusal and recovery evidence, showing one stable identity |
| 3:45–4:20 | Narrow developer/provider pilot and what it will test |
| 4:20–5:00 | Achieved result, exact links and focused ask |

Keep wallet setup out of the timed purchase demonstration while explaining its human consent. Warm actual backend services and confirm finite policy before stage. Keep a dated recording/offline backup. An unknown attempt stays unresolved: announce the switch to a recorded run rather than initiating another payment.

The deck needs factual rewriting, especially page 8: it still says local/unpublished, missing public URLs and pending workspaces/DB. Correct those facts together with README, notes and video; preserve complete-app limitations until earned. Do not turn all caveats into slide headlines. State achieved behavior clearly, keep evidence labels visible, and put deeper limitations in precise notes/Q&A.

One real developer/provider integration commitment would improve the business story. Proposed subscription or per-fulfilled-request revenue remains a hypothesis. No current customer, margin, grant award or production cost/latency advantage is established. Demonstrating reliable payment does not guarantee useful content or fair exchange.

## Assessment completion and remaining work

All three Orca assessment tasks reported succeeded. Their assigned reports and evidence are present. Existing source, canonical docs, task states, PDF, deployment and submitted destinations were preserved. This assessment neither completes TASK-005 onward nor fixes the production defect. The next application task is the paid-resource worker slice after reconciling TASK-005 readiness; UI/presentation work should follow the dependency boundaries above.

After assembling this packet, the coordinator ran `python -X utf8 tools/check-docs.py` and `python -X utf8 fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict`: both exited 0. The first checks 21 canonical Markdown files; it does not certify every assessment artifact or its semantic freshness. Git status showed only the new `docs/finals-assessment/` directory, with no tracked source diff. These documentation checks add no application or chain evidence.

The practical outcome to pursue is specific: **an agent makes a useful choice, authorized funds move through both required SDKs, the correct report unlocks after evidence agrees, and a lost response produces no second financial handoff.** That is the behavior to make memorable and reproducible for finals.
