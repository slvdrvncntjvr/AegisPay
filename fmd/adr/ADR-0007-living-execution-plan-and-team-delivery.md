# ADR-0007 — Living execution plan, checkpoint reconciliation, and conflict-safe team delivery

- **Date:** 2026-07-19
- **Status:** Accepted
- **Version:** FMD 4.2.0 → 4.3.0. No `idea.md` schema or seed-context contract change;
  IdeaForge remains 2.1.0.
- **Supersedes:** ADR-0006 decision 4 **only to the extent that it deferred a task-style handoff
  pending real-build evidence**. FMD still does not execute code, review PRs, or replace the coding
  agent / gstack.

## Trigger (real friction, not speculative rigor)

A team ran FMD 4.2 during a hackathon. The generated docs became inconsistent on each sprint and
cost time to reconcile; completed work did not update a task/execution state, so nobody could trust
what was ready, blocked, done, or invalidated after a decision/pivot. This is the exact proof
ADR-0006 said was missing when it deferred `tasks.md`/build machinery.

The failure is not “too few docs.” FMD already had an `implementation-plan`, decision ledger,
reconcile language, and postmortem. The failure was that no artifact owned live execution state and
no event required a checkpoint transaction. A document called “living” without a trigger and owner
is still static.

## Primary-source findings checked (2026-07-19)

- GitHub Spec Kit separates technical planning from tasks; its task template groups work into
  independently testable user-story slices, uses stable task IDs, explicit dependencies and `[P]`
  only for different files/no dependencies, and derives parallel execution from those facts.
  Its evolving-spec guide updates the spec first, then plan/tasks, and its `converge` command appends
  remaining work without renumbering history.
  - <https://github.com/github/spec-kit>
  - <https://github.com/github/spec-kit/blob/main/templates/tasks-template.md>
  - <https://github.com/github/spec-kit/blob/main/docs/guides/evolving-specs.md>
  - <https://github.com/github/spec-kit/blob/main/templates/commands/converge.md>
- GitHub Flow uses one branch per unrelated change and a PR for review. Protected branches can
  require reviews and status checks; auto-merge lands a PR only after requirements pass. Merge
  queues test temporary combinations against the latest base but are not a universal free/private
  baseline. GitHub explicitly says only simple competing-line conflicts are resolvable in its web
  editor; other conflicts need local resolution. Automation can prove a combined tree passes tests;
  it cannot infer the correct product intent of an arbitrary semantic conflict.
  - <https://docs.github.com/en/get-started/using-github/github-flow>
  - <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>
  - <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request>
  - <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue>
  - <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/addressing-merge-conflicts/resolving-a-merge-conflict-on-github>
- Playwright recommends user-visible behavior, isolated tests, resilient user-facing locators,
  web-first assertions, traces on first retry, and stable CI (one worker by default there). Projects
  can model setup dependencies; sharding is for suites whose runtime justifies multiple jobs. GitHub
  Actions is free on standard runners for public repositories; private GitHub Free has included
  minutes, so an always-sharded/browser-matrix default would waste a hackathon budget.
  - <https://playwright.dev/docs/best-practices>
  - <https://playwright.dev/docs/test-configuration>
  - <https://playwright.dev/docs/ci>
  - <https://playwright.dev/docs/test-global-setup-teardown>
  - <https://playwright.dev/docs/test-sharding>
  - <https://docs.github.com/en/billing/concepts/product-billing/github-actions>

## Decision

### 1. One canonical living execution plan; no parallel `tasks.md`

Upgrade the existing conditional `docs/implementation-plan.md`. It owns task/execution state with
stable `TASK-###` IDs, dependencies, owner, bounded write scope, work reference (branch/PR), status,
and executable gate/evidence. `TASK-###` is deliberately verbose: FMD already uses `T-###` for
security threats, so reusing it would corrupt traceability. Product intent remains in the PRD,
architecture in system design, test intent in the QA plan, and decisions/pivots/history in the
decision ledger. The ledger does not override those canonical specs; any disagreement is a failed
checkpoint that must be reconciled. The plan links; it does not duplicate them.

Tasks are independently testable vertical slices wherever possible. Setup/foundation exists only
when it blocks slices. Execution waves are derived from the dependency DAG; two ready tasks are
parallel only if their write scopes do not overlap. The number of waves therefore scales from the
real context rather than a fixed “MVP → Final” phase sequence.

### 2. Event-owned checkpoint transaction

A checkpoint runs on task state changes, accepted decisions/pivots, newly discovered dependencies,
material failed gates, time/team/scope changes, and session/milestone boundaries. It observes code +
tests, updates the task ledger, updates canonical docs only when their owned truth changed,
recomputes ready/blocked/cut work, and attaches evidence. Code that merely implements an unchanged
spec does **not** churn docs.

Contributors normally own their task row. One plan steward owns cross-task reordering, dependencies,
and shared write scopes. `in_review` is set before merge; `done` only after integration and a passing
gate on the current base. IDs are never reused; abandoned work is `cut`, not deleted.

PR eligibility is separate from release readiness: a task being `blocked` only controls when that
task may start. It does not block a small, already-scoped PR whose targeted checks pass and whose
diff is intentional and mergeable. Deployment, pilot, and downstream-task gates are evaluated
separately.

### 3. Deterministic structural gate + judgment guidance

**GATE (stdlib checker):** `tools/check-implementation-plan.py` rejects malformed/hidden/duplicate
rows, missing/duplicate/malformed dependency IDs, invalid status, unresolved/self/cyclic dependencies,
partial trace-ID matches, active tasks behind unfinished dependencies, missing required cells/work
refs, and `in_review`/`done` rows without explicit observed result/artifact evidence outside the
command. The consistency checker reports this as **T6**. On a valid plan the checker also **emits
the topological execution waves** and flags **same-wave write-scope overlaps** as parallel-safety
warnings (advisory by default; failing under `--strict`). Wave computation and literal path-overlap
are deterministic; genuine semantic scope independence and slice quality stay in GUIDANCE below.

**GUIDANCE (human/agent judgment):** whether a task is a good vertical slice, whether the owner is
best, whether write scopes are semantically independent (the checker catches only literal path
overlap, not shared-import coupling), whether a failure changes the plan, and whether a conflict
resolution preserves both intents. Do not fake-mechanize these with regex.

### 4. Conflict prevention before conflict resolution

The emitted `AGENTS.md` instructs team builds to use one `task/TASK-###-slug` branch per task, one owner,
bounded write scopes, early small PRs, latest-base integration, and required tests. Clean compatible
updates may be auto-merged/queued when the repository host and plan allow it. Semantic conflicts
must be investigated against canonical docs, resolved in the smallest diff, tested, and escalated
after three failed attempts (the existing Iron Law). Blanket `ours`/`theirs` is prohibited.

There is no honest “automatic conflict fix” that works for every PR for free. A merge tool can join
non-overlapping text; CI can reject a broken result; an AI can propose a semantic resolution. None
can decide product intent safely without tests/review.

### 5. Playwright is conditional, not a fashionable default

The QA template gains a browser-E2E section only for products with a browser UI. Start with the
core demo journey on Chromium in PR CI, isolated data, user-facing locators, web-first assertions,
and trace-on-first-retry. Add browsers/devices when the audience/rubric requires them; shard only
when measured suite runtime makes it worthwhile. The implementation plan records the exact command
and `TC-###` coverage. FMD does not add dependencies or emit a host-specific workflow blindly.

### 6. Two different improvement loops

- **Build-level:** self-reconciliation updates the plan/docs on evidence-producing events.
- **Kit-level:** FMD/IdeaForge improve only from a post-build retro and curated human decision.
  The framework never rewrites its own templates from its own output; that would amplify its priors.

## Context cost and lean check

- No new generated doc and no second task file. The larger plan is loaded only when a build crew /
  tracked implementation selects it.
- The always-on `AGENTS.md` gains a short conditional execution block; depth stays in the plan.
- One small stdlib checker is justified because task/dependency integrity is deterministic and the
  reported failure was loss of trustworthy state.
- Host-specific pre-push hooks, PR templates, CI workflow files, CODEOWNERS generation, and AI merge
  bots are deferred. FMD lacks repository-host, visibility, package-manager, team-handle, and test
  profile inputs; emitting them now would be speculative and brittle.

## Consequences

- **Easier:** a fresh human/agent can see current work without reconstructing chats; team allocation
  and parallelism come from explicit dependencies/scopes; completed/cut work remains auditable;
  changed behavior and docs travel together only when needed; browser UI gets a practical E2E path.
- **Harder:** the plan steward is a real responsibility; each PR carries a small state update; teams
  must resist declaring unsafe tasks parallel just to look fast.
- **Still outside FMD:** writing code, opening/merging PRs, configuring repository protection, and
  choosing/installing project dependencies. FMD specifies the contract; the coding layer executes it.
- **Unproven:** the 4.3 mechanism must now run through one full team build. Measure stale task rows,
  doc-only churn, write-scope collisions, conflict escalations, checkpoint time, and whether the
  Playwright smoke caught a demo-path regression. That evidence decides the next change.
