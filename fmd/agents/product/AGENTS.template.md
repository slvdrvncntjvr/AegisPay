# {project_name} — Agent Guide

<!--
TEMPLATE — emitted to the TARGET PROJECT's root (not the factory). The orchestrator fills
{placeholders} from idea.md + the system design. Loaded every turn in the target repo, so keep
it lean (≤ ~200 lines). Push depth into /docs links; do not inline what a link can carry.
-->

## Project overview
{project_name} is {value_prop_one_liner}. It serves {segment} who {pain}.

## For teammates (new here? 30-second orientation)
You only need the `/docs` and this file — not the framework internals. The conventions you'll meet:
- **`F-###` = a feature; `INV-###` = a hard "must-never" guardrail** (holds across every change). Tie each code change to an `F-###`; never breach an `INV-###`. Details live in the PRD + QA plan.
- **Acceptance criteria & tests are written in EARS** — plain testable sentences, e.g. `WHEN <trigger>, the system SHALL <result>`, and for guardrails `the system SHALL NEVER <do X>`. It's just a format that maps 1:1 to a test — write yours the same way.
- **`docs/DECISION-LEDGER.md` owns decisions, pivots, rejected choices, names/immutable IDs, and
  decision assumptions**; the PRD owns product behavior. When generated,
  **`docs/implementation-plan.md` owns live execution state** (TASK status/dependencies/owners).
  Read `docs/index.md §0` for every concern's owner; do not duplicate facts across them.
- **If the `pre-commit` hook blocks you** ("ADR changed but ledger didn't"): add the matching `DECISION-LEDGER.md §3` line and re-commit — or `git commit --no-verify` for a genuine exception. It only keeps the decision record honest; it never freezes your work.

## Architecture
{architecture_summary}
See [System Design](./docs/system-design.md) for components, data flow, and trade-offs.

## Build & run
```
{build_commands}
```

## Test
```
{test_commands}
```
All changes must pass tests before they're considered done.

<!-- KEEP this block only when implementation-plan was selected; for solo/no-plan builds remove it. -->
## Living plan + team delivery
Read [`docs/implementation-plan.md`](./docs/implementation-plan.md) before coding. It is the one
execution-state home; product intent/architecture/test definitions/decisions stay in their canonical
docs. At every task event or session end, run its checkpoint transaction.

- **Start a task:** either claim one `ready`, unowned `TASK-###` yourself, or start one already
  assigned to you (`Owner` pre-filled by the Keeper — do not re-claim it). Create
  `task/TASK-###-short-slug` from the current default branch, then give the Keeper the branch/work
  reference so it records `in_progress`. One task/owner/branch; no shared branches.
- Obey `Depends on` and `Write scope`. Same-wave work is parallel only when scopes are disjoint.
  Ask the plan steward before touching a shared/out-of-scope file or changing cross-task ordering.
- Open a small draft PR early. Name `TASK-###`, affected `F-/INV-###`, docs impact (`none` is valid),
  and exact validation commands.
- **When you finish the work — do this yourself, in the same PR, before requesting review:**
  1. Run `python3 fmd/tools/check-implementation-plan.py docs/implementation-plan.md`; fix any REJECT.
  2. Give the Keeper real observed evidence for `Gate / evidence` (`result: PASS`, `CI: green`, or
     an artifact URL) — a command alone is not evidence.
  3. Ask the Keeper to record `in_review`; do not edit the task row yourself.
  4. Update canonical docs **only if intended behavior actually changed** — implementing the
     existing spec unchanged should not churn docs. Decisions/pivots go to the ledger, not the plan.
- Bring in the latest default branch before final review and rerun gates. Clean passing updates may
  auto-merge/queue if configured. For conflicts: investigate both intents + canonical docs, make the
  smallest resolution, run targeted tests + core smoke, and escalate after 3 failed attempts. Never
  blanket-pick `ours`/`theirs` for a semantic conflict.
- **Do not edit the plan ledger directly.** Give the Build Keeper your branch/PR/CI/test evidence;
  it records the checkpoint and is the sole writer of task status. It sets `done` only after the
  change is integrated and the gate still passes on the current base.
- Run `python3 fmd/tools/check-implementation-plan.py docs/implementation-plan.md` before review
  (adjust `fmd/` to this project's kit path).
- **GitHub delivery (if active in the plan):** Project cards and Issues are a projection, not
  execution truth. The Keeper runs a preview then applies only its exact manifest SHA. Do not edit a
  card or close an Issue expecting it to rewrite the plan; bring PR/CI evidence back through a
  reviewed checkpoint. A sync problem suspends the projection, never your authority to continue work.

## Code style & conventions
- Language / runtime: {language}
- Formatting: {formatter}
- Naming & patterns to follow: {conventions}
- Patterns to avoid: {anti_patterns}

## Stack currency (verify before coding — overrides your training memory)
Fast-moving frameworks/SDKs drift. **Do not emit framework code from memory.** Before writing
against any pinned library, confirm the current convention in that version's official docs. If
you can't verify, say so — never ship a plausible-but-stale API.

| ❌ Stale / from memory | ✅ Current (this project) | Why |
|------------------------|---------------------------|-----|
| {stale_api_or_lib} | {current_api_or_lib} | {reason / link} |
<!-- Seed from the system design's chosen stack; add a row every time a stale API is caught (self-anneal). -->

Pinned versions to confirm at setup: {pinned_versions}.

## Do not touch
{do_not_touch}

## Decision ledger & reconcile discipline (read before you change a recorded choice)
Decision history lives in [`docs/DECISION-LEDGER.md`](./docs/DECISION-LEDGER.md), not in memory or
chat. Product behavior remains in the PRD, architecture in system design, tests in the QA plan, and
execution state in the implementation plan. `docs/index.md §0` is the ownership map. This is
tool-neutral across IDEs/agents:
- **Read the ledger for decisions** — §1 (names/immutable IDs), §2 (decision assumptions), §3
  (pivots/decisions). Never state a §2 UNVALIDATED assumption as fact; never rename an IMMUTABLE ID.
- **The brief is never frozen.** When a decision changes, log the pivot in §3 and reconcile every
  affected canonical doc in the same checkpoint. If ledger and canonical doc disagree, stop and
  reconcile; do not let either silently override the concern's owner.
- **ADR ⇒ ledger line, same commit.** Any `docs/adr/` change needs a matching §3 entry. The
  `pre-commit` hook enforces this.
- **Invariant audit.** Any change touching an `INV-###` guardrail (data, copy, rules) gets a §5
  audit line before merge.
- **Rebrand = a logged pivot** (type `rebrand`): propagate the new public name everywhere except
  the IMMUTABLE identifiers in §1.
- **Before any external milestone** (pitch/demo/handoff) run the reconcile pass: the ledger and
  `docs/index.md §0` must agree across live branches, and docs travel with the code they describe.
- Install the guard once: see [`hooks/README.md`](./hooks/README.md).

## Definition of done
- Build passes, tests pass.
- If a living plan exists: the `TASK-###` row has current status/work ref, exact gate evidence, and
  plan validation passes; the plan steward has reconciled the ready/blocked/cut view after merge.
- Traceability preserved: code change ties to an `F-###`; that `F-###` has a test in the QA plan.
- Any `INV-###` guardrail the change touches still holds (must-never rule not breached); audit logged.
- Decisions/pivots recorded in `docs/DECISION-LEDGER.md`; any ADR paired with a §3 ledger line.
- Framework APIs verified against the pinned version's docs (not memory) — see Stack currency.
- If the change emits a computed number: it cites its `EQ-###` from [Methods](./docs/methods.md) and carries a confidence (glass-box). *(Only if the project computes numbers.)*
- No secrets committed; any network-exposed surface has auth/authz.
- Docs updated when behavior changes.

## References
- [Decision Ledger](./docs/DECISION-LEDGER.md) — decisions, pivots, rejected choices, names, decision assumptions
- [Docs index](./docs/index.md) — §0 says which doc owns which fact
- [PRD](./docs/prd.md) — features by `F-###`, invariants by `INV-###`
- [System Design](./docs/system-design.md)
- [Methods / glass-box ledger](./docs/methods.md) — equations + confidence *(only if the project computes numbers)*
- [QA Test Plan](./docs/qa-test-plan.md) — traceability matrix + exact automation commands
- [Implementation Plan](./docs/implementation-plan.md) — live `TASK-###` state, dependencies, owners,
  scopes, gates, and checkpoint protocol *(only if generated)*

<!-- For scoped, path-specific rules, see ./.cursor/rules/*.mdc (generated from cursor-rules/). -->
