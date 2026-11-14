# AegisPay submission packet — draft

Prepared 2026-11-07 for Salvador Vincent Javier (solo; Discord handle unconfirmed). These are authored presentation sources, not evidence of a deployed app. The supplied handbook is local ignored source; basename/update/SHA256 and page mapping are in [research](../research.md#builder-handbook-reconciliation--2026-11-07).

## Public-link register

| Deliverable | Current state | Completion gate |
|-------------|---------------|-----------------|
| Public repo | https://github.com/slvdrvncntjvr/AegisPay; main/TASK-002 pushed | TASK-011 real root-declared workspaces; final README delivered |
| Live working app | Public saved-proof site and separate authenticated console preview exist; full worker/model/payment release incomplete | TASK-012 deployed app/worker/DB and remote gates |
| Two-minute demo | [112-second evidence replay](aegispay-demo.mp4) recorded; full live model-purchase recording outstanding | TASK-013 actual hosted model purchase recording; public link |
| Pitch deck | [Eight-slide source](pitch-deck.md) and [public PDF](https://github.com/slvdrvncntjvr/AegisPay/blob/main/docs/submission/AegisPay-pitch-draft.pdf) published | TASK-013 export/public Slides, Canva or PDF; anonymous viewing |
| Short write-up | Draft below | Reconcile final behavior before submitting |
| Team | Salvador Vincent Javier; Discord missing | Confirm handle and Luma/form registration |
| Testnet proof | [README proof](../../README.md#testnet-proof) and saved report | One authorization vs separate claim; full model-purchase release proof still needed |

Submission form supplied by handbook: https://forms.gle/hQ73PnsR1w2YwAq57. No form submitted here. Registration requires Luma RSVP plus registration form; required support screenshots/registration status are unverified.

The Nov 7, 2026 noon Philippine-time deadline has passed. No extension or organizer-specific Gas approval supplied. Continue by user instruction without asserting late acceptance, on-time eligibility or guaranteed win. The two-minute target satisfies the handbook even if the form accepts up to five minutes.

## Draft short write-up

AegisPay explores how an agent buys useful API data while a human retains explicit spending limits. The intended user is an agent developer integrating small paid data services; demand/pricing remain hypotheses. The planned bounded model sees two fictional reports, requests an immutable HTTP 402 quote and chooses whether the report is useful. Deterministic tools enforce trusted prices/budgets; keys stay outside the model.

The implemented Testnet SDK spike uses Noir 0.3.0 and the mandatory October 24 device, agent and escrow contracts. An owner registers a virtual device and policy, funds escrow, and a server-held constrained agent key prepares/signs one 300000-stroop authorization. Velo 1.0.0 Gas sponsors, submits and observes the same transaction. Independent successful envelope, invocation and event evidence matches Velo identity. Authorization credits merchant-pending escrow; claim is separate. Actual over-cap refusal is deployed-contract simulation, not an included failed payment.

One historical real authorization and separate claim are linked in the README. Model-loop code, PostgreSQL entitlement implementation, UI, four workspaces and separate preview are implemented, and TASK-002 fixes were accepted. Full actual model/payment/hosted release remains incomplete; the video is an evidence replay. [Current readiness](../evidence/demo-readiness-2026-11-14/report.md) owns the remaining gates.

## Final publication checklist

- Preserve accepted TASK-002/TASK-011 foundations; complete the remaining app/release gates through TASK-010.
- Deploy actual app/private worker/DB via TASK-012; verify public access and ownership without exposing keys/reports.
- Record real model choice/current quote and payment request/execution, then verified access. Preserve pending time/evidence; label earlier recording and fixtures.
- Export deck and publish video/deck with anonymous access. Replace missing README link statuses with verified URLs; validate source anchors against final code.
- Confirm Discord, registration/support evidence and late acceptance/Gas interpretation; disclose unresolved facts. Validate all six requirements, ordered README and form fields.
- Run both documentation checks; these do not establish application acceptance. Submit only through an authorized delivery step and retain actual receipt, never planned submission as success.
