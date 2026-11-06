# Docs Generation — How FMD turns idea.md into /docs

The orchestration. The operating brain is [`agents/ORCHESTRATOR.md`](../agents/ORCHESTRATOR.md);
this doc holds the pipeline diagram and the gate definitions it links to.

**Boundary:** the factory **starts at an `idea.md`.** Authoring the brief (and any optional
validation, research, interviews) is upstream and out of scope. FMD's only check on the brief is
a **structural preflight** — does it have the sections the first docs read? — which never
refuses to run and never judges the idea's merit.

## Inputs

- The **seed set** (the source of truth besides the codebase; any author, no validation/"frozen"
  status required): `idea.md` (required) + optional `brand`/`market` siblings + a `context` block.
- `manifest.json` (the build graph — drives selection, order, and QA assignment)
- `templates/`, `subagents/`, the two factory playbooks (`mvp-vs-final-scoping`,
  `doc-review-checklist`)

## Procedure (summary — full version in ORCHESTRATOR.md)

0. **Context intake & doc-selection** (step ZERO). Read the `context` block (team, time, build
   type, judged, computes-numbers, exposed-surface, outlives-demo) from the seed set, or ask once.
   `selection_mode`: **auto** (rules propose, human confirms) or **learning** (human picks with
   reasoning, FMD critiques against cost/value/need and may affirm). Sizes the set for step 2.
1. **Structural preflight** on `idea.md` (feature set + `F-###` present; selected-doc dependency
   sections exist). Missing load-bearing section → ask once, or generate and record an
   `[assumption]`. Never refuses.
2. **Select** the doc set from `manifest.json` using the context block: `mvpDocSet` first, then
   every template whose `condition` holds (`security-compliance`, `methods`, `pitch-kit` for judged
   work, GTM for actual release/adoption need, onboarding for handoff, `sad`/`implementation-plan`,
   decision ledger for multi-session/pivots, `change-record`, `ops`, and larger-scale docs). North-star
   collapse below team scale. Don't generate every template.
3. **Generate in dependency order** read from each entry's `dependsOn`. Load only the template +
   its `dependsOn` docs (just-in-time). Dispatch to the `producedBy` subagent.
4. **Emit the product agent files** from `idea.md` + system design. If `implementation-plan` is
   selected, collect delivery-only facts (including optional GitHub delivery configuration), generate
   the stable `TASK-###` task DAG + task-checkpoint/run-evidence protocol + GitHub projection section, run
   `tools/check-implementation-plan.py`, and include the conditional branch/PR/conflict and
   terminal sync rules in emitted `AGENTS.md`. The plan is the only execution-state file; do not add
   `tasks.md`. Each task agent reconciles its own evidence-backed checkpoint; the plan steward owns
   cross-task dependencies and shared scopes. `tools/sync-github-project.py` defaults to a read-only
   mutation manifest; it does not create GitHub state until the lead records an active run and the
   task agent applies an exact reviewed manifest digest.
5. **QA loop** per doc (below).
6. **Review gate:** `playbooks/doc-review-checklist.md`. Failures route back to step 3.
7. **Emit** `/docs` + root agent files; clean up `./.fmd-work/`.

## QA as two targeted suite reviews

Run deterministic checks first (including the plan checker/T6). Then run two fresh-context reviews
once across the selected suite: product/claims and architecture/traceability. Each states exactly
what it checked and what remains human-verified. A failure regenerates only the affected cluster and
reruns only that review; after two repair cycles, escalate to the lead. The humanizer is explicit-only
for externally published prose and runs after facts are settled.

## Dependency order (visual)

```
idea.md
  │
  ├─► BRD ─► MRD                      (why / market)
  │            │
  │            ▼
  ├─────────► PRD ─► FRD ─► SRS       (what / behavior)
  │                          │
  │                          ▼
  ├──► System Design ─► Technical Design ─► API Spec ─► Data Model   (how)
  │                          │
  │                          ▼
  ├──► Design System    Security & Compliance                       (cross-cutting)
  │            │              │
  │            ▼              ▼
  └─────────► QA Test Plan ◄──┘        (traceability home — every F-### gets a test)
                   │
                   ▼
              Release / GTM
```

The factory reads this order from `manifest.json` `dependsOn`, not from this picture.

## Drop-in usage

```bash
# idea.md can be authored any way you like (one sitting is fine) — no freeze/validation required.
git submodule add <fmd-repo-url> fmd     # or copy / template the repo
# point your agent at:
#   "Read fmd/agents/ORCHESTRATOR.md and run the factory on ./idea.md"
```

> **You don't generate every template for every project.** The **context intake sizes the set**:
> always index → idea → PRD → system-design → data-model → QA plan, then add by condition
> (+ security if exposed, + methods if it computes numbers, + gtm/onboarding if judged/team,
> + sad/implementation-plan for a build crew, + change-record/ops for team/long-lived builds).
> North-star collapse below team scale.
