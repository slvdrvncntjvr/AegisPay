# ADR-0008 — Preview-first GitHub delivery projection for the living implementation plan

- **Date:** 2026-07-21
- **Status:** Accepted
- **Version:** FMD 4.3.0 → 4.4.0. No `idea.md` schema, seed-context, or IdeaForge change;
  IdeaForge remains 2.1.0.
- **Extends:** ADR-0007's living execution plan. It does not supersede the rule that the coding
  layer owns branches, PRs, CI, and merges.

## Trigger (owner delivery friction, still unproven at build scale)

The owner needs each newly generated tracked build to have a usable GitHub Projects + Issues path,
without repeating a bespoke terminal setup or turning a visual board into a second task truth. The
specific desired loop is: `idea.md` → FMD → `docs/implementation-plan.md` already carrying a
terminal-ready Issue/Project handoff.

ADR-0007 deliberately deferred generic host-specific workflows because FMD lacked host, visibility,
team, and test facts. This request supplies a concrete GitHub/terminal need, but not a reason to
move delivery configuration into the shared seed or to emit unattended workflows. The change must
therefore remain conditional, explicit, and reviewable.

## Decision

### 1. Markdown plan remains the only execution-state authority

`docs/implementation-plan.md` continues to own stable `TASK-###` identity, dependencies, owner,
write scope, work ref, status, and gate evidence. A GitHub Issue is a task discussion/PR record; a
GitHub Project is a visual query layer. Neither Issue closure nor a card move may silently rewrite
the plan. Inbound PR/CI/Issue observations become a proposed plan diff or PR and still pass the
existing checkpoint discipline.

### 2. Every selected plan emits a GitHub delivery section

The section is always present when FMD generates an implementation plan, with delivery mode,
repository/Project placeholders, status mapping, a durable Issue marker, and first-run terminal
commands. The orchestrator asks one consolidated delivery question for the optional configuration;
that information remains in the plan, not `idea.md` or the shared context block. This is FMD
solution-space/build state, so no contract change is warranted.

### 3. A bundled terminal synchronizer is preview-first and scoped

`tools/sync-github-project.py` validates the plan with the existing T6 parser, derives waves, and
prints a mutation manifest by default. Only `--apply` may create or update remote state. It creates
one Issue per `TASK-###`, marked `<!-- fmd-task:TASK-### -->`, and updates only its generated body
block; comments, labels, assignees, and PR discussion are preserved. It manages explicit custom
Project fields (`Task ID`, `Plan Status`, `Wave`) rather than assuming a user's built-in Status
options. The tool needs `python3`, `gh`, normal issue access, and GitHub's `project` token scope.

FMD does **not** emit a GitHub Action, webhook, PAT, App, branch rule, or automatic reconciliation
workflow. Those are repository-specific execution choices to add only after a real build proves
their value.

## Consequences

- **Easier:** a fresh FMD build has a complete terminal command path for its task ledger; stable
  IDs prevent duplicates and the wave field makes plan concurrency visible in a Project.
- **Harder:** the operator must choose the repository/Project at delivery time and review any
  remote mutation manifest; the plan steward still reconciles evidence before marking work done.
- **Guardrail:** this is a projection, not two-way sync. GitHub adds convenience but never replaces
  durable, reviewable Markdown execution truth.
- **Unproven:** run the 4.4 loop on a real multi-task build. Measure setup time, duplicate/missed
  Issues, Project drift, checkpoint overhead, and whether the board improved allocation or merely
  added ceremony. A failure returns the mechanism to the post-build retro; it does not justify more
  automation by itself.
