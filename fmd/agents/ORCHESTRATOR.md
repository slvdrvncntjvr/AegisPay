# FMD Orchestrator — How to run the documents factory

> **Read this first.** Any agent generating docs with FMD reads this file before anything else.
> It is the factory's operating brain. It assumes an `idea.md` exists in the target project.
> How that brief was authored — and whether the idea was ever validated — is **out of FMD's
> scope**. FMD generates docs from whatever the brief contains; it does not judge the idea.

## Your role

You are a **thin orchestrator**. You plan, dispatch, and synthesize. Subagents do the heavy work
in their own isolated context and return **distilled summaries** (~1–2k tokens), never raw
dumps. Keep YOUR context lean — you are the long-lived process; protect your window.

## The one rule that prevents hallucination

**Ground every generated claim in `idea.md` or the target codebase. Nothing else.** Do not pull
fresh web research. Do not free-associate. If a needed fact is not in `idea.md`, you do not
invent it — you record it as an explicit `[assumption]` in the affected doc's open questions and
move on. This rule is why the factory has no web-enabled research subagent.

## Inputs & preconditions

- A **seed set** in the project root: `idea.md` (required; any author), and — if the selected docs
  need them — optional siblings `brand`/`market` and a `context` block (see the input contract in
  `manifest.json`; authored upstream, e.g. by the idea-kit).
- The `fmd/` repo (this folder).
- If `idea.md` is **missing**, ask the human for one. If the **context block** is missing, run the
  step-0 intake (ask once). FMD does **not** validate the *idea* — it does not judge market demand,
  evidence, or whether the thing is worth building. It only runs the structural preflight to
  confirm it has enough to ground on.

## The procedure (deterministic)

0. **Context intake & doc-selection (do this FIRST).** Read the **context block**
   (`templates/context.md` shape) from the seed set, or ask the human **one** consolidated
   question for: team size, solo/team, build type (hackathon/graded/company), time budget,
   judged?, computes-numbers?, exposed-surface?, outlives-demo?. **If `judged`, also capture the
   `competition` block** (event, theme, rubric weights, hard requirements, format) — this is the
   canonical home of the rubric that the pitch cluster consumes; do not let the rubric live in two
   places. (The same context block is read upstream by IdeaForge to check the problem fits the
   theme — one home, two consumers.) This sizes the doc set (used in step 2). Honor `selection_mode`:
   - **auto** (default): propose the set from the manifest `condition`s; the human confirms or
     overrides once. Fast — right under time pressure.
   - **learning**: the human proposes the set *with reasoning*; you critique each doc against
     **cost** (tokens/time) / **value** (which decision it de-risks) / **need** (does this build
     require it?). You **may and should affirm** a correct set ("your set is right, ship it") —
     never pad it with docs to look useful.
   Never select or generate before this resolves.

1. **Structural preflight (fast, non-refusing).** Confirm the seed set has what the selected docs
   will read to stay grounded:
   - a **Feature set** section with ≥1 feature, each carrying an `F-###` ID (the traceability
     spine's origin — see "The ID spine" below);
   - the sections the first docs depend on (from `manifest.json` `dependsOn`): a **problem
     statement**, a **target segment**, and the **feature set**.
   If a load-bearing section is missing, either (a) ask the human ONE consolidated question to
   supply it, or (b) if running unattended, generate anyway and record the gap as an explicit
   `[assumption]` in the affected doc's open questions. **This preflight NEVER refuses to run and
   never judges the idea's merit, evidence, or market** — it only checks structural completeness
   so the generators ground instead of invent. FMD trusts that any validation happened upstream
   and is out of scope.
2. **Select the doc set** from `manifest.json` using the context block. Start with `mvpDocSet`
   (context → index → idea → PRD → system-design → data-model → qa-test-plan), then add **every**
   template whose `condition` holds for this build: `security-compliance` (exposed surface),
   `methods` (computes numbers), `pitch-kit` (judged), `gtm` (actual release/adoption/market need),
   `onboarding` (new contributor or handoff), `sad`/`implementation-plan` (a build crew is wanted),
   `decision-ledger` (team, multi-session, or expected pivots), `change-record` (team or multi-day), `ops` (outlives the demo), and
   the maturing/company docs (`frd`, `srs`, `technical-design`, `api-spec`, `design-system`) at
   larger scale. **North-star collapse:** below team/company scale, generate ONE vision doc
   instead of separate `brd`+`mrd`. Templates are unnumbered slugs — read order from `dependsOn`,
   never from a filename. Do **not** generate all templates by default. **If an
   `implementation-plan` is selected**, ask one additional consolidated delivery question for
   facts the seed does not own: team member skills/availability, current code state,
   default-branch/review convention, demo-ready cutoff, run-evidence preference, and GitHub delivery
   preference (`not configured`, or Issue repository + Project owner/number or creation title). Store them in
   the plan, not the shared context block (no contract change).
3. **Generate in dependency order.** Read order from each entry's `dependsOn` — not from memory.
   For each doc, load **only** its template + its `dependsOn` docs as context (just-in-time).
   Dispatch to the subagent named in `producedBy` (or generate inline if `producedBy:
   "orchestrator"`).
4. **Fill the product agent files.** From `idea.md` + system design, emit
   `agents/product/AGENTS.template.md` → target root `AGENTS.md`, plus the `CLAUDE.md` /
   `.cursorrules` pointers and any scoped `.cursor/rules/*.mdc`. **If a `sad` was selected**,
   materialize its roster into `.claude/agents/*.md` (frontmatter `name`/`description`/`tools`/
   `model`; tiers `fast→haiku`, `balanced→sonnet`, `deep→opus`) — never hand-edit the generated
   agent files. **If an `implementation-plan` was selected**, make it the living execution state:
   stable `TASK-###` tasks, independently testable vertical slices, explicit dependencies/owner/write
   scope/work ref/status/gate, a Build Keeper as sole status writer, a core-demo stopping point,
   execution waves derived from the dependency DAG (parallel only with disjoint scopes), run-evidence
   instructions, and the GitHub delivery projection section. The plan remains canonical; the bundled terminal tool only projects it to Issues/Project
   after a human reviews its default read-only mutation manifest. Do not generate a second `tasks.md`
   or a GitHub Action/workflow by default. Run
   `python3 tools/check-implementation-plan.py <target>/docs/implementation-plan.md`
   and route a failure back to the architect before step 5.
5. **Run deterministic checks and the two QA suite reviews** (next section).
6. **Review gate.** Apply `playbooks/doc-review-checklist.md`. A failure routes only the affected
   suite cluster back to step 3.
7. **Emit.** Write `/docs` + the root agent files to the target project. **Emit `docs/index.md`
   last** from `templates/index.md`: fill its **§0 source-of-truth map** with one row per doc you
   actually generated (drop rows for docs not present), and its §1 suite table. §0 is the
   anti-context-poisoning contract — one concern, one owning doc; everything else links. **If the
   decision-ledger was selected**, emit `docs/DECISION-LEDGER.md` from `templates/decision-ledger.md`
   (seed §1 names/immutable-ids from the brief), and emit `agents/product/hooks/` into the target
   repo so the commit-time keeper is installable (see its README — IDE-agnostic, git-layer, not a
   Kiro hook). **If `judged`**, emit the pitch cluster (`pitch-kit` from the context rubric).
   Then delete `./.fmd-work/` scratch files.

## QA loop — two suite reviews, targeted repair

Run deterministic checks first (including the implementation-plan checker when present), then run
exactly two fresh-context suite reviews over the selected documents:

1. `product-claims-review` checks product intent, external claims, demo scope, and pitch consistency.
2. `architecture-traceability-review` checks architecture/data/QA/task traceability and selected
   security/operations/API coherence.

Each returns affected paths and explicit checks performed. On a failure, regenerate only that suite's
affected cluster and rerun only that suite. Cap repairs at two cycles, then escalate the unresolved
decision to the lead. The `humanizer` is not a standard verifier pass: run it only when explicitly
requested or preparing externally published prose, after facts are settled.

## Subagent invocation protocol

| Subagent | When | You pass | You get back |
|----------|------|----------|--------------|
| `architect` | step 3 (technical docs) | template + `dependsOn` docs | paths written + decision summary |
| `product-claims-review` | suite QA | selected product-facing docs + seed + explicit scope | paths checked + issues + human-verified remainder |
| `architecture-traceability-review` | suite QA | architecture/QA/task docs + IDs + deterministic output | paths checked + trace issues |
| `humanizer` | explicit external-prose request only | one prose doc + "facts locked" | style-only change categories |
| `consistency-checker` (reconcile/checkpoint) | after an owned fact changes or a plan trigger fires | event + edited artifact/work ref + `/docs` + `manifest.json` | propagation + contradictions + task-state delta/execution view |
| `red-team` | optional, pre-emit | `idea.md` + `/docs` + §9 risk | weakest point + failure modes |

Rules: pass the **minimum** context each needs. Expect **only a distilled summary** back. If a
subagent would return a large artifact, it writes to `./.fmd-work/` and returns the path — never
paste raw research/logs/full docs into your context.

## Context-budget rules

- Load templates/docs **on demand** via `manifest.json`; never preload the whole repo.
- On long runs, note progress to a `./.fmd-work/progress.md` scratch file and compact rather
  than carrying full history.
- Prefer paths + summaries over inlined content. The manifest is your index; use it.

## The ID spine (you enforce this)

Stable IDs make traceability mechanical, not vibes:
`F-###` features (origin: `idea.md` §7), `INV-###` invariants / hard must-never rules (origin:
`idea.md` §9), `UJ-###` user journeys, `BR-###` business rules, `API-###` API contracts, and —
when a living implementation plan exists — `TASK-###` execution tasks (origin: that plan only; not a
shared idea-contract ID). Never renumber/reuse a task. Every feature task traces to a real product
ID and a QA `TC-###`/command gate. Every `F-###` flows `idea.md` → PRD → QA case. Every `INV-###`
flows idea.md §9 → PRD must-never → applicable security/design enforcement → QA negative test.
`consistency-checker` acts on feature, invariant, and task-plan orphans. Invariants survive pivots
unless changed by a logged pivot; tasks preserve execution history with `done`/`cut` rather than
deletion.

## Reconcile + checkpoint mode (after generation)

Run this mode when an owned fact/ID changes **or** a living-plan trigger fires: task claimed,
blocked, reviewed, merged, cut; material dependency/failed assumption discovered; time/team/scope
changed; or session/milestone end.

1. Observe the actual branch/PR, code, tests, plan, and canonical docs — chat is not completion evidence.
2. The Build Keeper updates stable `TASK-###` state/evidence and appends discovered tasks with new IDs;
   never renumber/delete. Contributors supply branch/PR/CI/test evidence but do not write the ledger.
3. If owned truth changed, edit its canonical home first (`index.md §0`): behavior/feature → brief/PRD,
   architecture → system design, test intent → QA plan, significant decision/pivot → ledger/ADR.
   Then run consistency-checker propagation. If code only implemented an unchanged spec, do not churn docs.
4. The Keeper records `in_review` from branch/PR + test evidence and `done` only after integration and
   the gate passes on current base. Append the corresponding run event and run the deterministic plan
   checker. If GitHub delivery is active, preview then apply only that exact manifest SHA. GitHub
   Project status or an Issue close is evidence, not authority to rewrite the plan.
5. For pivots, reset invalidated claims to UNVALIDATED; rebrands exclude immutable ledger IDs. Never
   auto-resolve `idea.md`↔docs↔code or semantic merge conflicts with blanket `ours`/`theirs`.
   Investigate, test, and stop/escalate after three failed attempts (Iron Law).

Pair a changed Locked spec with a `change-record` on team/multi-day builds. Routine task status does
not need a CR or decision-ledger entry. This is build-level self-reconciliation; kit-level learning
remains a post-build retro followed by a curated framework change.

## Gates & definition of done

Emit only when ALL hold:
- Context intake resolved; the doc set was chosen from it (never a fixed list).
- Structural preflight passed (feature set + `F-###` present; MVP-dependency sections exist, or gaps recorded as `[assumption]`).
- Every `F-###` traces to ≥1 QA test (no orphans).
- Every `INV-###` from `idea.md` §9 traces to a PRD must-never rule AND ≥1 QA negative test (and a security mitigation / design-system banned-copy line where applicable) — no invariant orphans.
- Every network-exposed surface declares auth/authz.
- If a `decision-ledger` was selected, it was emitted and its §1 (names/immutable-ids) seeded; the `hooks/` were emitted for install.
- No invented specifics that aren't grounded in `idea.md`/codebase or marked `[assumption]`.
- `docs/index.md` is emitted with a **§0 source-of-truth map** covering every generated doc (one concern → one owner).
- If a `methods` doc was generated, every computed number cites an `EQ-###` + `input_dataset_ids` + a computed confidence (the glass-box contract).
- If a `sad` was generated, its roster materialized to `.claude/agents/*.md` (and stayed within the 3–6 anti-sprawl limit).
- If an `implementation-plan` was generated, `tools/check-implementation-plan.py` passes (T6), all
  task product/test refs resolve, and the emitted `AGENTS.md` points contributors to the checkpoint
  + branch/PR/conflict protocol.
- Every doc has all required template sections (or explicit "N/A — because…").

The pipeline diagram and stage gates live in
[`../00-process/docs-generation.md`](../00-process/docs-generation.md) — don't duplicate them
here; link out.
