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

Current Nov10 checkpoint: TASK-001/002/003/004/011 foundation gates are done. TASK-014 redesigned the public proof viewer, TASK-015 deployed it at the unchanged submitted Vercel URL, and TASK-016 published the refreshed PDF at its unchanged GitHub path in91f9680. The full durable/model purchase, authenticated console, hosted backend and complete TASK-010/012/013 release remain unfinished. TASK-005 has implementation and offline/PostgreSQL evidence, but its actual Nov9 payment remains unknown/unentitled. User explicitly authorized reopening the same backend Task after the Orca retry breaker; one writer and independent read-only review resume without another financial handoff. See the plan and finals evidence for exact gate limits; historical “no workspaces/DB/site/deck” summaries elsewhere are earlier checkpoints.

Root instructions: [AGENTS.md](../AGENTS.md), [README](../README.md), [environment contract](../.env.example). No SAD/agent roster, duplicate tasks.md, full enterprise suite or production operations manual is generated. See context for the selection rationale.

## 2. Health check

Run `python tools/check-docs.py` for link/ID/coverage/section/package-peer checks and `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` for the task ledger/DAG. Actual observed results live in document review.

Before the live demo also require the QA release gates, security pre-milestone checklist and real SDK/ledger evidence. Documentation readiness and technical integration readiness are separate states.
