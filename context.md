---
team_size: 1
mode: solo
build_type: hackathon
time_budget: 2d
judged: true
computes_numbers: true
exposed_surface: true
outlives_demo: false
selection_mode: auto
competition:
  name: Velo × Noir Agentic Payment Hackathon
  theme: Autonomous API purchasing using Velo and Noir on Stellar Testnet
  format: Official format unverified; prepare the brief's 90-second demonstration
  rubric: null
  hard_requirements:
    - Meaningful use of both SDKs and genuine agent purchasing, per IDEA.md
    - Official acceptance of Gas Station rather than Velo Pay remains unverified
---

# Build context

Prepared 2026-11-07 from [IDEA.md](IDEA.md) and the user's instruction to infer decisions and prioritize a quick MVP. No additional intake is required for routine implementation choices.

**[assumption] Capacity:** one developer assisted by one coding agent, approximately 16–24 focused engineering hours over two days after credentials are available. This is a planning range, not a delivery guarantee or the event deadline. No submission date, judging weights, or named teammates were provided. Missing external facts stay unverified; they do not become invented requirements.

**Selected:** PRD, system design, data model, QA plan, security, methods, a compact API contract, a compact UX specification, implementation plan, decision ledger, onboarding, pitch kit, change record, research provenance and document review. The API and UX documents resolve concrete implementation boundaries despite the small project size. The API's small technical-design dependency is folded into system design instead of generating another document.

**Omitted:** BRD/MRD/FRD/SRS, standalone technical design/RFC, release campaign, production ops, postmortem, SAD and a multi-agent roster. The existing idea owns market hypotheses; a single executor needs no build crew. The implementation plan is still selected for tracked execution. The pitch and onboarding cover the demo handoff. A future production launch requires a new scope decision.

**Adaptations to FMD:** the user's explicit research and inference instructions override the factory's no-new-research and intake-confirmation defaults. Research is recorded separately. Use the checked-in plan template/checker statuses rather than older `in_review` guidance. Two review lenses are performed by the primary agent; independent fresh-context reviews are not claimed. No framework source files are changed.

**Authority:** [docs/index.md](docs/index.md) maps canonical owners. The execution addendum in IDEA.md supplies stable IDs without rewriting the original brief. Concrete dated implementation choices supersede alternatives left open in that brief; a scope or invariant change must be recorded.
