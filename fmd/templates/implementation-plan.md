# Implementation Plan — living execution state

> **Purpose:** the canonical bridge from specs to code **and the current build state**. It answers
> what is ready, in progress, blocked, done, or cut; who owns it; what it may touch; and what
> evidence proves it. It does not duplicate product intent, architecture, test definitions, or
> decisions — those remain in the PRD, system design, QA plan, and decision ledger.
>
> Stable task IDs originate here as `TASK-###`; never renumber or reuse one. Markdown is canonical;
> GitHub Issues and Projects are outbound projections only.

**Plan steward:** <one person/agent who owns cross-task replanning and shared scope decisions>
**Last checkpoint:** <ISO-8601 timestamp + observed event>
**Deadline / demo cutoff:** <distinguish submission time from demo-ready time>
**Current stopping point:** <last independently working slice honestly demoable if time ends now>

`done` means the task agent locally validated and reconciled the completed branch, its evidence, and
the outbound Project state. A `done` PR may still be open; its linked Issue closes when GitHub merges
it into the default branch. A later evidence-based repair may change a false completion back without
a special teammate ritual. `in_review` is not an allowed status.

## 1. Planning inputs

- **Current code state:** <greenfield / skeleton / working slices; link rather than narrate history>
- **Team capacity:** <member/agent → skills, availability, current task; `UNASSIGNED` is honest>
- **Core demo journey:** <UJ-### or shortest user-visible proof of value>
- **Highest implementation risks:** <integration, data, auth, deployment, performance, etc.>
- **Required quality commands:** `<fast targeted command>` · `<full required command>`
- **Browser E2E:** <N/A | command + covered TC-### cases>
- **Hard constraints / rubric:** <links to canonical owner documents>

## 2. Task ledger

Allowed status: `ready | in_progress | blocked | done | cut`. A `ready`, `in_progress`, or `done`
task has only `done` dependencies. `Work ref` is `—` until claimed, then an exact branch, PR, or
equivalent work reference. `Gate / evidence` contains an exact backticked command; `done` also has
observed evidence outside that command, normally `result: PASS`. Use comma-separated `TASK-###`
dependencies or `—`, and concrete paths/globs in `Write scope`.

Keep one canonical table ordered by task ID. Do not move rows when status changes or create a second
editable status ledger; derive execution waves from `Depends on`.

| ID | Outcome / trace | Depends on | Owner | Write scope | Work ref | Status | Gate / evidence |
|----|-----------------|------------|-------|-------------|----------|--------|-----------------|
| TASK-001 | <runnable skeleton; infra> | — | <owner> | <paths> | — | ready | `<boot/build command>` |
| TASK-002 | <smallest core slice; F-###, UJ-###> | TASK-001 | <owner> | <paths> | — | blocked | TC-### · `<targeted command>` |
| TASK-003 | <next independently testable slice; F-###> | TASK-001 | <owner> | <paths> | — | blocked | TC-### · `<targeted command>` |

## 3. Checkpoint transaction and PR protocol

Run one checkpoint when a task is claimed, blocked, completed, cut, repaired, or fails a gate; when
a dependency/scope/decision changes; and before a handoff or milestone. The task agent:

1. Inspects the branch/PR, code, tests, and current canonical documents. Do not infer completion
   from chat or a checkbox.
2. Runs the local gate, then previews and SHA-bound applies
   `python3 FMD/tools/reconcile-task.py --task TASK-### ...`. This updates only the task row,
   affected dependency rows, and one appended structured fact-only `task_checkpoint` event.
3. Reconciles a changed owned fact in its canonical document (product behavior → PRD, architecture
   → system design, test intent → QA, material decision → ledger/ADR). Do not churn docs when code
   implements the current specification unchanged.
4. Lets the helper recompute dependency state: a blocked task with all dependencies done becomes
   `ready`; any non-cut dependent with an unfinished dependency becomes `blocked`, preserving its
   work ref and evidence.
5. Runs targeted Project preview, then SHA-bound apply/verification for its changed task and affected
   dependents if delivery mode is active. A Project failure suspends only the projection.
6. Opens a tracked PR with exactly two metadata lines: `Task: TASK-###` plus `Closes #N` for `done`,
   or `Refs #N` for blocked/repaired work. An intentionally untracked PR omits `Task:` entirely.

Reviewers report observed evidence; they do not own another status transition. The plan steward
decides cross-task ordering, new dependencies, and shared scopes. Git/CI may reject a broken merge,
but semantic conflicts still require the smallest intent-preserving resolution and targeted tests.

## 4. GitHub delivery projection (conditional, terminal-managed)

**Run ID:** `RUN-<YYYYMMDD>-<short-slug>`

**GitHub delivery mode:** `not configured | previewed | active | suspended | closed`

| Setting | Value |
|---|---|
| Issue repository | `<OWNER>/<REPO>` |
| Project owner | `<GitHub user or organization>` |
| Project number / create title | `<number> / <new Project title>` |
| Projection direction | Markdown plan → marker-backed Issue snapshot + Project fields |
| Activation record | `<lead name> · <timestamp> · preview SHA-256 · targeted scope>` |

The synchronizer validates the whole plan, but repeatable `--task TASK-###` selects the only
marker-backed Issue and Project item it may mutate. It preserves titles, discussion, comments,
labels, assignees, PR activity, and unrelated content. It writes both built-in `Status`
(`Todo` / `In Progress` / `Blocked` / `Done` / `Cut`) and custom `Plan Status`
(`Ready` / `In Progress` / `Blocked` / `Done` / `Cut`). Do not delete a pre-existing `In Review`
option; it is simply unmanaged and unused. A Project owner configures the built-in options once; a
preview refuses apply when that configuration is absent.

1. Validate: `python3 fmd/tools/check-implementation-plan.py docs/implementation-plan.md`.
2. Preview: `python3 fmd/tools/sync-github-project.py --plan docs/implementation-plan.md --run-id RUN-<...> --repo <OWNER>/<REPO> --project-owner <OWNER> --project-number <N> --task TASK-###`.
3. Lead-review the printed `MANIFEST SHA256`, then apply the identical scope with
   `--apply --expected-manifest-sha <SHA>`.

GitHub never writes the canonical task plan, closes an Issue, changes human Issue content, or merges
a PR. After the guard bootstrap merges, make `Tracked task checkpoint / validate` a required default-
branch check. The guard checks out only trusted default-branch tooling and treats PR-head documents
as unexecuted data.

## 5. Run evidence and derived view

`docs/run-evidence.jsonl` is append-only and fact-only. Unknown timing, causality, rework, or
feedback remains `unknown`. A task checkpoint records structured status, work reference, local
command, factual result, and source. `check-implementation-plan.py` prints topological execution
waves and same-wave literal scope warnings; use that output rather than a competing phase plan.

## 6. Plan change log

| Timestamp / event | Tasks changed | Why / evidence | Canonical docs reconciled |
|-------------------|---------------|----------------|---------------------------|
| <ISO-8601 · kickoff> | TASK-001… | initial dependency/risk cut | PRD · system design · QA plan |
