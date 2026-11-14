# Documentation index — AegisPay

**Maintained by:** active project implementer. **Prepared:** 2026-11-07. **FMD:** VERSION file 4.6.0; manifest metadata still says 4.5.0. Templates/checker are the operational reference; the kit is preserved.

## 0. Source-of-truth map

| Concern | Canonical owner | Definition / precedence |
|---------|-----------------|-------------------------|
| Product origin and stable-ID mapping | [IDEA.md](../IDEA.md) | Original vision/problem/segment; §23 adds source feature/invariant IDs without replacing the original |
| Build context and official event facts | [context.md](../context.md) | Inferred capacity, selected/omitted docs, event unknowns and explicit workflow adaptations |
| Product behavior and scope | [PRD](prd.md) | Features, journeys, business rules, hard invariants and acceptance; dated execution decisions resolve brief alternatives |
| Architecture, stack pins and recovery sequencing | [System design](system-design.md) | Components, integration boundaries, deployment, state flow and trade-offs |
| Storage and constraints | [Data model](data-model.md) | Entities/types, relationships, uniqueness, locks, privacy and migrations |
| HTTP contracts | [API spec](api-spec.md) | Proposed application routes, schemas, stable API IDs and response/error semantics |
| Quantitative methods | [Methods](methods.md) | Deterministic equations/input provenance and confidence; no invented financial outputs |
| Auth/security/abuse controls | [Security](security-compliance.md) | Session/role rules, rate/body limits, threat/invariant enforcement, secrets and incident response |
| UI composition and copy | [UX specification](design-system.md) | Console routes/components/states/tokens and banned misleading labels |
| Tests and release evidence requirements | [QA plan](qa-test-plan.md) | Requirement-to-test traceability, exact future commands, mock/live distinction and acceptance |
| Live execution state | [Implementation plan](implementation-plan.md) | Stable task DAG, ownership/scopes/status, gates, checkpoint protocol and delivery settings |
| Decisions and assumptions | [Decision ledger](DECISION-LEDGER.md) | Append-only initial choices/pivots/rejections, immutable identifiers and invariant audits |
| Locked-document changes | [Change record](change-record.md) | Lifecycle and future material change entries; no initial fictional changes |
| New executor orientation | [Onboarding](onboarding.md) | Read/run pointers; does not own architecture or test definitions |
| Demo narrative and rehearsal | [Pitch kit](pitch-kit.md) | Timed honest script, business hypotheses, Q&A owner and post-demo probes |
| Submission source packet | [Submission drafts](submission/README.md) | Recording script, eight-slide deck and short write-up; unpublished until verified app/deployment |
| Research provenance | [Research](research.md) | Checked primary sources, package inspection, limits and live unknowns; raw registry snapshot in evidence/ |
| Documentation verification | [Document review](document-review.md) | Structural check results, two primary-agent review lenses and remaining unverified execution |
| Suite navigation and ownership | [This index](index.md) | One canonical owner per concern and current document inventory |

Derived references do not override owners. If intended behavior changes, update its owner first and reconcile references. Never silently edit historical payment identities or assume the decision ledger overrides a product rule. FMD templates are framework material, not a second app spec.

## 1. Document suite

The suite began on 2026-11-07; individual dated checkpoints and the implementation plan own current progress. Product, architecture, data, HTTP, methods, security, UX and QA remain execution specifications pending their actual release gates. Context, research and ledger distinguish assumptions from observations; document checks establish structure, not a working app. The supplied Nov 5 handbook provides contract/rubric provenance; the newer user-supplied Nov 8 Top15 email says finals date/venue TBA.

Latest Nov14 recovery: [wallet recovery](evidence/wallet-recovery-2026-11-14/report.md) fixes visible status actions and safe Freighter diagnostics, selects user-provided current owner GAXQ...NZS7 before provisioning, and preserves the expired never-handed record/agent identity/nonce.152PostgreSQL/118unit/19authenticated-console browser/types/lint/build pass. [New independent hosted database](evidence/hosted-release-2026-11-14/report.md) is FreePG17/Singapore in verified AegisPay Finals, with strict TLS1.3,5canonical migrations and17empty application tables; expiryDec14. No current wallet signature, deposit, app purchase or hosted worker acceptance is implied. The live release and original unresolved incident remain open.

Earlier Latest Nov14 local setup: [confirmed-wallet setup report](evidence/live-setup-2026-11-14/report.md) records completed TASK-024/025 engineering scopes. Local app3019/worker3020 are running for manual Freighter setup; lifetime funding ceiling1000000stroops is enforced.150PostgreSQL/17authenticated-console browser checks,types/lint/build pass;22real access assertions pass,two sessions revoked,eight execution tables0. New agent account activation via one Friendbot request is observed separately from device registration/escrow/payment. Both workers stopped at quota; coordinator repaired the partial-review repeat-submit finding and verified final gates. Original identity still409/NOT_FOUND,held/unentitled; no terminal outcome inferred. Complete live/manual/hosted release remains open.

Earlier Nov14 checkpoint: [readiness report](evidence/demo-readiness-2026-11-14/report.md) and [concrete rehearsal steps](evidence/demo-readiness-2026-11-14/rehearsal.md) supersede stale current-state narrative. TASK-021 wallet recovery/wake and TASK-022 narrowed safe diagnostics pass local scopes; TASK-009 remains blocked on actual wallet consent/lifecycle. Final local checks pass112 unit/143 PostgreSQL/50 offline spike/21 production browser, types/lint/build. Initial Gemini MODEL_TIMEOUT is preserved; later unchanged-config tool roundtrip passes2POST200/exit0 with zero financial actions. TASK-023 adds [reviewed host/local preparation](evidence/demo-readiness-2026-11-14/hosted/README.md): isolated local DB/schema/config,17actual HTTP startup checks and stopped owned processes,16emptytables/no actor seed. Anonymous preview6/6 and read-only provider inventory pass within narrow scopes; no independent remote DB/free slot is selected. Full live/manual QA, current authenticated release and hosted worker qualification remain incomplete. Original unknown payment/nonce/reservation/holds remain untouched.

Historical Nov11 checkpoint: TASK-001/002/003/004/011 foundations and TASK-008/014/015/016/017/018/019/020 pass their respective gates. The authenticated preview is live at https://aegispay-auth-preview.onrender.com on source7411e9d. Real HTTPS qualification passes four role/viewport journeys,45HTTP checks,16assets,244captured requests and actual app TLS1.3, with31sessions revoked and11financial/execution tables empty. Two final local harness repairs were tested and accepted by the coordinator after worker quota exhaustion. The public proof viewer and refreshed PDF retain their submitted links. Application source b2661c0 has123 PostgreSQL/107unit/50offline spike and19production browser passes, types/lint/build. The Free DB expires2026-12-10T11:55:40.452333Z. The original Nov9 payment remains unknown, held and unentitled. Nov11 configured Google tool choice returned503; one gemini-2.5-flash compatibility check returned404. TASK-007 depends on working provider generation; live wallet/payment/recovery and complete TASK-010/012/013 release remain unfinished. The plan and dated evidence own exact gate limits.

Root instructions: [AGENTS.md](../AGENTS.md), [README](../README.md), [environment contract](../.env.example). No SAD/agent roster, duplicate tasks.md, full enterprise suite or production operations manual is generated. See context for the selection rationale.

## 2. Health check

Run `python tools/check-docs.py` for link/ID/coverage/section/package-peer checks and `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` for the task ledger/DAG. Actual observed results live in document review.

Before the live demo also require the QA release gates, security pre-milestone checklist and real SDK/ledger evidence. Documentation readiness and technical integration readiness are separate states.
