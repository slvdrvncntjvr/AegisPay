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
- At preparation official event facts were unavailable; the later handbook reconciliation below resolves rubric/format/tuple while preserving registration/Gas/late-acceptance uncertainties. Capacity stays assumed.
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

## Historical preparation execution limits

No package installation/typecheck/build, DB migration, app unit/integration/browser test, model call, wallet registration, contract read, Velo request, payment, claim or deployment was executed. No working credentials were supplied or sought from private files. Public metadata/signatures support selected APIs but do not prove live compatibility. TASK-001/TASK-002 and QA gates must establish those facts. No zero-mistake guarantee or event-qualification claim is made.

## Implementation follow-up — 2026-11-07

The preceding sections describe the preparation session. Subsequent execution installed the pinned harness and passed imports/typecheck/lint; synthetic spike tests and generated/funded Testnet accounts are recorded in run evidence. One Orca worker independently verified package metadata/APIs and reviewed the implementation, finding missing ABI type/lifecycle validation and an expiry race across journal I/O. Fixes and targeted regressions now exist. Both Orca workers reached their usage limit and were explicitly stopped with confirmed process-exit receipts before coordinator edits; the reviewer did not issue a final approval of the coordinator's later code.

Read-only deployment checks rejected the November candidate policy ABI and verified the explicit October tuple. Signed agent XDR and credential values are absent from committed artifacts. At that earlier checkpoint full driver wiring, fixture provisioning and live payment/application gates were incomplete; later live follow-up below supersedes those technical-spike limits. The historical preparation-only review is not an application acceptance result.

Live spike follow-up: the primary executor implemented and tested the full guarded driver, then ran one real Velo-sponsored authorization, an over-cap contract simulation refusal and separate merchant claim. 41 offline tests and 42 opt-in acceptance tests passed with no skips; final typecheck/lint/import gates passed. The SDK event-flag incompatibility was repaired with an independently successful transaction/embedded-event match, with targeted negative tests. Subsequent independent review found terminal-envelope cleanup recovery and fee-source reconciliation issues. Repairs/gates are pending in a separate worker; no approval or new test passes are claimed by this documentation task.


## Handbook and submission reconciliation — 2026-11-07

Scope: context, ordered root README, index, implementation plan, ledger, system design, PRD, research, onboarding, pitch kit, draft lifecycle note, this review and new submission prose sources. No code, manifest, lockfile, ignore file, framework/checker, chain artifact or run-evidence file changed. Private environment/journals were not read; no push, hosting, model call, wallet signature, payment or application test was performed.

All 13 handbook pages were inspected via local PyMuPDF with UTF-8 stdout; basename/update/hash/page mapping recorded in research. The ignored PDF was neither copied nor linked as a public repo artifact. Official facts now resolve the six requirements, mandatory October 24 tuple, rubric, deadline and presentation timing. The passed deadline/no-extension condition is explicit; no on-time eligibility, organizer-specific Gas approval or guaranteed win is asserted.

The README follows the handbook's complete ordered headings, lists all catalog environment names without values, and points to actual SDK call sites and one real authorization plus separate claim. Fixed-commit source links refer to the observed public TASK-002 implementation; refresh them after later source changes. Two saved reports remain one payment. Actual simulation refusal is not an included failed transaction. Fee-source claims are withheld pending review fix.

The single-package/local-only choice is superseded in canonical intent by minimal real root-declared workspaces and required hosted app, retaining the selected Next Node + private Node worker + PostgreSQL/Drizzle architecture. Existing spike sources remain stable; old task paths are logical components mapped in system design. TASK-011 depends on TASK-002 and precedes TASK-003; TASK-012 follows TASK-010; TASK-013 follows TASK-012. Unfinished tasks remain blocked; TASK-002 stays in_progress for both review fixes. F-005 real LLM remains in scope, access unverified. Specs remain Draft, so no fictional Locked CR was added.

Draft two-minute recording script, eight-slide five-minute pitch/three-minute Q&A source and short write-up are usable planning artifacts. They contain no fake UI screenshots, public app/media URLs, demand claims or completed model-purchase claims. Remaining submission inputs: real workspace bootstrap; review-fix/release gates; model access; DB/app/UI; hosting configuration/working public URL; actual video and public deck URLs; Discord handle/registration confirmation; external Gas interpretation and late acceptance. Public GitHub delivery is now configured and PR/Issue/Project rituals are not required.


### Observed documentation gates for this reconciliation

- `python tools/check-docs.py` — PASS, exit 0: 21 top-level/root Markdown files, local links, required sections, 12 features, 10 invariants, 31 QA cases, stable references, index inventory and SDK peer decision.
- `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` — APPROVE, exit 0: 13 valid task rows, coherent dependency/state DAG, no same-wave write-scope overlaps. First invocation found noncontiguous new rows and missing exact gate commands; document formatting/commands were repaired, checker unchanged.
- Direct read-only source validation — PASS: exact 13-section handbook README order, all 25 environment catalog names listed, local links in all three new submission Markdown sources resolve, eight deck slides present. These nested sources are outside the top-level checker's file count.
- `git diff --check` — clean after removing Markdown hard-break trailing spaces. Isolated work ref: slvdrvncntjvr/handbook-submission; final commit reported to coordinator.

These are documentation/format checks only. The documentation checker's generic “application tests and live SDK/ledger integration remain unrun” footer describes its own scope, not a denial of the separately recorded historical spike. No code/application/live gate was rerun here.


## Post-review payment acceptance follow-up - 2026-11-07

Both findings were inspected and integrated as 5db51dd: terminal cleanup retries safely after interruption; actual fee independently compares the outer charged fee against Velo. Worker offline regressions passed 50/50; integrated opt-in acceptance passed 51/51, no failures/skips. Saved authorization and claim handoff markers were checked before identity-only observation; both fee sources match at 82496 stroops. No new payment was made. Latest artifact: docs/evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794064999769.json. Earlier pending-review statements are historical. TASK-002 is done and TASK-011 ready. All ten invariants remain unchanged; app/DB/model/UI/hosting gates remain unfinished. Docker/PostgreSQL infrastructure was independently verified, superseding the earlier absent-engine observation, but no application concurrency gate is implied.

## Current implementation readiness review — 2026-11-14

The [readiness report](evidence/demo-readiness-2026-11-14/report.md) reconciles implemented source, exact local gates, external consent/provider dependencies and remaining full-live release. Root README/onboarding/submission/pitch current-state claims now reflect real workspaces/app/DB/UI, recorded replay and public PDF, while historical final-checkpoint and live evidence remain intact. Wallet recovery, lock order, included failure and wake received independent read-only review. TASK-022 is narrowed to safe optional diagnostics; disabled automatic purchase is not claimed implemented or a canonical manual-release prerequisite. Current documentation command receipts are stored with this checkpoint; documentation checks do not qualify live application behavior.

Final Nov14 documentation check and strict22-task plan check both exit0 after restoring required onboarding sections and reconciling exact serial write scopes. Initial docs failure and three strict-plan failures remain in the dated evidence directory; coordinator escalation recorded. The docs checker still prints a generic historical application-tests-unrun footer; actual current application results are the separate112-unit/143-PostgreSQL/50-spike/21-browser/build receipts, never inferred from this checker.


### 2026-11-14 final independent preparation checkpoint

Independent reviewer accepts TASK-021/022 local scope, safe unchanged-config Gemini roundtrip, reviewed Free hosting preparation and17actual empty loopback app/worker ingress checks with16application tables0, five canonical migration checksums, exact Docker-port/DB ownership and private config separation. New TASK-023 owns that separate preparation; no actor seed, model/payment job, chain/financial handoff, remote mutation or full release is claimed. Provider inventory records successful2xx JSON rather than an unobserved exact200; original receipt is retained. Docker/ACL/scope/encoding/initial model failures remain dated evidence, with repairs and limits in the current report. Final source manifest and docs/strict-plan receipts accompany the local delivery.

## 2026-11-14 confirmed-wallet setup continuation

TASK-024/025 are locally complete within [their setup scope](evidence/live-setup-2026-11-14/report.md). Workers stopped at quota after a partial review; coordinator took over after exact assignment release, reproduced/repaired repeat-submit identity behavior and observed150PostgreSQL/17authenticated-console browser/types/lint/build passes plus22actual local role/session assertions. Original manifests remain historical. No independent post-repair agent review, human wallet signature, genuine app payment or hosted release is claimed. Render workspace creation remains a user dashboard action because the inspected public schema exposes none.
