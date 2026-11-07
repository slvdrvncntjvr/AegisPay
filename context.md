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
  format: Two-minute submission video; five-minute live pitch plus three-minute Q&A
  rubric:
    agentic_payments_fit: 30
    technical_execution: 25
    innovation: 20
    real_world_potential: 15
    pitch_and_demo: 10
  hard_requirements:
    - An agent decides, requests or makes a payment
    - Noir SDK calls the mandatory deployed October 24 Testnet contracts
    - Velo SDK builds other application parts
    - Stellar Testnet only
    - Public GitHub monorepo with real workspaces and ordered root README
    - Deployed working public website
---

# Build context

Reconciled 2026-11-07 from [IDEA.md](IDEA.md), the user-supplied Builder Handbook and observed integration evidence. Routine implementation choices remain delegated to the coding agent.

**Official source:** `Velo x Noir Agentic Payment Hackathon — Builder Handbook.pdf`, updated Nov 5, 2026; SHA256 `ac77495fd5512dc2d62924dbbe9d6fed6b18ea1b64d72a99c010e8a1ba0cd55b`. All 13 pages were read locally using PyMuPDF. The ignored PDF is not distributed or linked as a public repository file; [research](docs/research.md) records page-level provenance.

**Schedule:** all handbook times are Philippine time (UTC+8). Registration closed Nov 4 at 23:59; submissions closed Nov 7 at noon; top ten announcement Nov 7 at 16:00; face-to-face pitches Nov 8 from 13:00. The submission deadline is already past; no extension notice was supplied. The user asks work to continue. Do not claim on-time eligibility, registration completion, a top-ten place or a guaranteed win. Registration requires both Luma RSVP and the registration form; status is unverified.

**Builder:** Salvador Vincent Javier, solo; Discord handle and registration confirmation remain missing. [assumption] Capacity is approximately 16–24 focused engineering hours over two days after prerequisites, not a completion guarantee. User has authorized Orca workers, public GitHub delivery and hosting; this documentation worker does not push or provision hosting.

**Delivery:** public repository [slvdrvncntjvr/AegisPay](https://github.com/slvdrvncntjvr/AegisPay) and origin are configured; main and TASK-002 branches were pushed. Real root-declared workspaces and a working public app remain mandatory unfinished work. Keep Next Node + PostgreSQL/Drizzle + one private Node worker; [system design](docs/system-design.md) maps logical components into minimal real workspaces. No separate PR/Issue/Project ritual is required.

**Compatibility:** the handbook mandates the October 24 IDs already verified by the spike; October 7 IDs are retired. This resolves the mandatory tuple question. Velo Gas provides actual sponsorship, submission and status for the same Noir authorization. The handbook gives checkout/webhooks examples but no supplied organizer-specific approval of Gas; disclose that limit. Retain verified Velo 1.0.0 / Noir 0.3.0 pins instead of following the older alpha-tag installation example. Do not add an unrelated checkout as Noir proof. F-005 remains a real bounded LLM loop even though handbook examples allow rule-based agents; model access remains unverified.

**Selected:** PRD, system design, data model, QA, security, methods, API, UX, plan, ledger, onboarding, pitch, change record, research, document review and submission sources. The compact API/UX documents settle concrete boundaries. **Omitted:** enterprise BRD/MRD/FRD/SRS, standalone RFC/technical design, production ops, postmortem, SAD and duplicate task tracker. The original idea owns commercial hypotheses; production launch needs new scope.

**FMD adaptations:** explicit user research/inference instructions supersede repeated intake and no-research defaults. Follow checked-in plan/checker statuses; the executor is also steward. Framework files stay unchanged. [Index](docs/index.md) maps canonical owners; significant intent changes go in the ledger, and locked-spec changes require a change record.
