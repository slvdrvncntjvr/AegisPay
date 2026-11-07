# Documentation review record

**Date:** 2026-11-07. **Scope:** generated project docs, source addendum, root agent instructions and dependency research. Application implementation is outside this preparation task.

## Deterministic checks

Observed results, 2026-11-07:

- `python tools/check-docs.py` — PASS, exit 0: 21 Markdown files; local links, required template sections, 12 features, 10 invariants, 31 QA cases, stable ID references, index inventory and researched SDK peer decision.
- `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` — APPROVE, exit 0: ten valid task rows; coherent dependency/status DAG; no same-wave write-scope overlaps.

No application command is counted as passed. These checks validate structure/traceability, not all possible semantic errors or live SDK behavior.

## Product and claims review

Performed by the primary agent using FMD's product/claims criteria; not an independent fresh-context subagent review. Inspected IDEA.md, context, PRD, UX, onboarding, pitch, README and decision ledger for scope/claim agreement.

- All twelve original P0 outcomes retained; five screen concepts consolidated without deleting an outcome.
- One asset/agent/merchant and two demo resources; no mainnet, fiat or custom smart-contract scope added.
- No demand/ROI/security-audit/conformance/speed/sponsorship-success claim manufactured.
- Evidence distinguishes local checks, live contract simulation, included transactions, authorization and claim.
- Official event rubric/eligibility and capacity remain explicitly unverified/assumed.
- Primary engineering research is recorded outside the original brief, as the user requested.

## Architecture and traceability review

Performed by the primary agent using FMD's architecture/traceability criteria; no separate reviewer is claimed. Inspected PRD → architecture → data → API → methods/security → QA → plan.

- Stable source IDs map original P0/I identifiers to features and invariants; all have downstream QA cases.
- Resolved SDK peer mismatch and confirmed preparation API from published Noir types.
- Event lacks asset/agent; verifier must inspect invocation and fee-bump identity mapping as well.
- Defined pre-handoff encryption, persistent reservation identity, durable handoff marker and observation-only ambiguous recovery.
- Locked quote/budget/nonce and unique evidence/entitlement constraints cover races; claim remains a separate aggregate operation.
- Protected fixtures, owner/worker scope and receipt recovery/window are explicit; no webhook mutation path exists.
- Tasks carry real future gates but no false completed statuses; initial ready task is bootstrap, UI follows live spike.
- Final consistency repair separated client retry keys from Velo operation keys and specified separate web/worker/spike environment files; Next's automatic web env loading must not receive worker secrets.

## FMD adaptations / discrepancies

VERSION is 4.6.0 while manifest version is 4.5.0. Older orchestrator/agent template mentions `in_review` and sole keeper writes; current implementation-plan template/checker uses five statuses and task-agent checkpoints. This suite follows the current plan/checker and makes one executor the steward. The API template's standalone technical-design dependency is folded into system design. Research/inferred intake replace the factory's default no-research/confirmation steps under the user's explicit instruction. Fresh-context subagent reviews were not run; two review lenses above are self-review. Framework files remain unchanged.

## Remaining execution verification

No package installation/typecheck/build, DB migration, app unit/integration/browser test, model call, wallet registration, contract read, Velo request, payment, claim or deployment was executed. No working credentials were supplied or sought from private files. Public metadata/signatures support selected APIs but do not prove live compatibility. TASK-001/TASK-002 and QA gates must establish those facts. No zero-mistake guarantee or event-qualification claim is made.

## Implementation follow-up — 2026-11-07

The preceding sections describe the preparation session. Subsequent execution installed the pinned harness and passed imports/typecheck/lint; synthetic spike tests and generated/funded Testnet accounts are recorded in run evidence. One Orca worker independently verified package metadata/APIs and reviewed the implementation, finding missing ABI type/lifecycle validation and an expiry race across journal I/O. Fixes and targeted regressions now exist. Both Orca workers reached their usage limit and were explicitly stopped with confirmed process-exit receipts before coordinator edits; the reviewer did not issue a final approval of the coordinator's later code.

Read-only deployment checks rejected the November candidate policy ABI and verified the explicit October tuple. Signed agent XDR and credential values are absent from committed artifacts. Full driver wiring, Noir fixture provisioning and all live authorization/refusal/claim/application gates remain incomplete. The historical preparation-only review is not an application acceptance result.

Live spike follow-up: the primary executor implemented and tested the full guarded driver, then ran one real Velo-sponsored authorization, an over-cap contract simulation refusal and separate merchant claim. 41 offline tests and 42 opt-in acceptance tests passed with no skips; final typecheck/lint/import gates passed. The SDK event-flag incompatibility was repaired with an independently successful transaction/embedded-event match, with targeted negative tests. A new independent review is being arranged; no approval of this new driver has yet been claimed.
