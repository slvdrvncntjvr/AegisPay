# ADR — FMD Architecture Decision Record

> Append-only log of significant decisions about FMD itself (distinct from `templates/_adr.md`,
> which is the ADR *template* emitted into target projects). Never edit a past entry — supersede it.

---

## ADR-0001 — Split the forge from the factory; restructure FMD as a context-engineered factory

- **Date:** 2026-06-29
- **Status:** Accepted
- **Context:** FMD v1 bundled idea.md *authoring* (validation, market research, interviews, the
  researcher subagent) with idea.md *consumption* (doc generation). This muddied the boundary and
  risked drift: a process that both authors and consumes a brief loses track of which claims were
  sourced vs invented, and a validator that helped write a brief won't reject it. The /agents
  folder also only served the emitted-product audience and lacked a factory operating brain. QA
  was a one-shot pass with no criteria, iteration cap, or escalation. Traceability was promised
  but not mechanically enforceable (no stable IDs). The manifest was an inventory, not a build graph.
- **Options considered:**
  1. Keep everything combined, add freeze discipline by convention — pros: no restructure;
     cons: relies on willpower every run, weak validator firewall, easy to cheat under deadline.
  2. Split authoring (forge/idea-kit) from generation (factory/FMD); make idea.md the frozen
     input contract; bake "ground only in idea.md" into the factory — pros: good behavior is the
     default, independent validator, leaner context; cons: a breaking restructure.
- **Decision:** Option 2. FMD becomes the factory only. Authoring moves to the idea-kit
  (stubbed here as pointers). FMD keeps `templates/idea.md` (input contract) + `validator`
  (firewall). Added: `agents/ORCHESTRATOR.md` (operating brain), a generator-verifier QA loop
  with named criteria + 3-iteration cap + human escalation, stable IDs (`F-/UJ-/BR-/API-###`)
  parsed by `consistency-checker`, a manifest build graph (`mvp`/`dependsOn`/`producedBy`/
  `verifiedBy`), an `agents/product/` split with scoped `.mdc` rules, hardened subagent input/
  output contracts, and one complete worked example (`sample-recon-ai`).
- **Consequences:**
  - *Easier:* mechanical, data-driven generation order + QA; lower drift; an un-skippable freeze.
  - *Harder / owed:* the idea-kit must actually exist in the parent knowledge base for the
    pointer stubs to resolve; this is a **major version bump (1.0.0 → 2.0.0)** — projects pinned
    to v1 must migrate.
  - The factory deliberately has **no web-enabled research subagent**; an unknown fact is flagged
    `[unverified]` and escalated, never researched.

---

## ADR-0002 — Decouple the idea-kit; delete the validation firewall; replace with a structural preflight

- **Date:** 2026-07-01
- **Status:** Accepted (supersedes the parts of ADR-0001 that made the idea-kit a required upstream and the `validator` an entry gate)
- **Context:** ADR-0001 made FMD assume a *finished, frozen, validated* `idea.md` produced by the idea-kit, and gated the run behind a `validator` subagent that scored the brief on startup-style criteria (the four tests, `said/did/paid` evidence floor, "talked to users") and could return `STOP-AND-FIX`. In practice FMD's primary use is **hackathon builds** (see the founder-knowledge-base steering: build-first is legitimate; validation is not the measure of progress here). Under that use:
  - Market/demand validation is the wrong question. A 3-hour build (e.g. Axon-Enjin's Drowzi) has no interviews and no paid evidence, yet its docs are complete and confident — because the *brief* was structurally complete, not because a market was validated.
  - The evidence apparatus **leaked into the output**: the `[unverified]` / `said/did/paid` tagging propagated caveats ("market size [unverified]") into generated PRDs, making finished docs *read* incomplete.
  - Requiring the idea-kit coupled two tools that should be independent.
  - **Key realization:** FMD's anti-hallucination property does **not** come from the validator or the evidence tags. It comes from (a) the orchestrator's "ground only in `idea.md`/codebase" rule and (b) `qa-anti-hallucination` S1 (no invented specifics) + S3 (no contradiction with `idea.md`). Those survive the cut. Only S2 (source-tag checking) was tied to the evidence apparatus.
  - **The one real risk** of a pure hard-cut: a thin `idea.md` with no feature set / `F-###` IDs leaves the traceability spine nothing to anchor to, so generators invent features. That is *structural*, not market validation.
- **Options considered:**
  1. Keep the validator firewall — cons: wrong criteria for the primary (hackathon) use; leaks caveats into docs; couples two tools.
  2. Hard-cut everything, pass `idea.md` as-is with no input check — pros: max speed; cons: loses the structural guard, so a thin brief yields invented features.
  3. Decouple the idea-kit (make it optional), delete the market-validation firewall, and replace it with a lightweight **structural preflight** folded into the orchestrator that never refuses — pros: keeps grounding + traceability, kills the caveat leakage, honors build-first; cons: FMD no longer enforces that anyone validated the idea (by design — that's now explicitly out of scope).
- **Decision:** Option 3.
  - The **idea-kit is now optional upstream**, not required, not vendored, not run by FMD. `idea.md` may be authored any way (hand-written, reverse-engineered from code, one-sitting draft, or the idea-kit).
  - The **`validator` subagent is deleted.**
  - A **structural preflight** lives in `ORCHESTRATOR.md` step 1: confirm the brief has a feature set with `F-###` IDs and the sections the MVP docs read (problem, segment, feature set). Missing load-bearing section → ask once, or generate and record an explicit `[assumption]`. **It never refuses and never judges the idea's merit, evidence, or market.**
  - The **evidence apparatus is removed** from the QA criteria (`qa-anti-hallucination` S2 reframed from "carries a source/confidence tag" to "traceable to `idea.md`/upstream/codebase, else labeled `[assumption]`"), the review checklist ("Sourced" → "Grounded"), and the FMD↔idea-kit contract (no `status: frozen` trust signal, no evidence floor, no `[unverified]` propagation required by FMD).
- **Consequences:**
  - *Easier:* FMD runs standalone on any brief; finished docs stop carrying validation caveats; the hackathon path has zero validation friction.
  - *Preserved:* grounding + traceability (the actual anti-hallucination guarantees) are untouched.
  - *Given up (deliberately):* FMD no longer asserts anything about whether the idea is worth building. If you want that discipline, run the idea-kit first — it's still there, just optional.
  - *Owed / migration:* **major version bump (2.0.0 → 3.0.0).** The idea-kit's `FMD-CONTRACT.md` and README are updated to describe an optional, decoupled relationship. The learning guide (`founder-knowledge-base/02-playbooks/fmd-learning-guide.md`) is updated to match.

---

## ADR-0003 — Adopt Tier A + B from CJ/Axon-Enjin's FMD (stack-currency register, source-of-truth map, glass-box methods ledger)

- **Date:** 2026-07-01
- **Status:** Accepted
- **Context:** A deep study of CJ Dela Torre / Axon-Enjin's applied FMD (the `matrix` repo especially) surfaced patterns our factory lacked. We tiered them by hackathon leverage and cost (see `founder-knowledge-base/02-playbooks/fmd-learning-guide.md`). Owner is about to test FMD on a real hackathon build, so we adopt the two cheap, clearly-right tiers now and defer the rest until a real build proves the need.
- **Decision:** Adopt Tier A + B (additive, non-breaking → minor bump 3.0.0 → 3.1.0):
  - **Stack-currency register (Tier A).** A `## Stack currency` block in the emitted `AGENTS.md` (`agents/product/AGENTS.template.md`) + a scoped `cursor-rules/stack-currency.mdc`, plus a hard **verify-live-before-coding** rule in the `architect` subagent: never emit framework code from training memory; confirm against the pinned version's docs; the register overrides memory. Rationale: AI agents reliably emit stale SDK code; on bleeding-edge stacks (Soroban/Rust, fast-moving AI SDKs) this is the highest time-saver in a hackathon.
  - **Source-of-truth map (Tier A).** A new emitted `docs/index.md` (`templates/_index.md`, `mvp: true`) whose **§0** maps each concern → exactly one owning doc (anti-context-poisoning: one fact, one home; everything else links). Orchestrator builds it from the doc set actually generated (emit step 7). `consistency-checker` T4 now also verifies the §0 map covers every generated doc with no dangling links.
  - **Glass-box methods ledger (Tier B).** A new `templates/14-methods.md` (`mvp: false`, `condition: "product computes or derives numbers"`, in `mvpConditional`) — gated exactly like `security-compliance`. Registers every computed output as an `EQ-###` with `DS-###` inputs + a computed confidence; the LLM narrates/cites but never originates a number. Produced by `architect`; enforced by a `qa-anti-hallucination` glass-box check (bare computed number with no `EQ-###` = S1 fabrication) and `consistency-checker` `EQ-/DS-` ref integrity.
- **Consequences:**
  - *Easier:* hackathon builds get stale-API protection + a clean SSOT map by default; number-heavy builds (Soroban escrows, data scoring, fintech) auto-pull a provenance ledger; static/no-number builds skip it automatically.
  - *Deferred (not adopted):* Tier C (richer build-guide doc, SAD→build-agents, phase-gated implementation plan) and Tier D (per-project Change Records / Locked lifecycle, OPS runbook). These wait until a real build demonstrates the need — adopting CJ's full governance mass now would be importing answers to problems we haven't hit.
  - *Owed:* validate all of this on the imminent hackathon build; self-anneal the stack-currency register from real caught-stale-API friction.

---

## ADR-0004 — v4.0: unnumbered docs, seed-set input, context intake + doc-selection model, build-phase docs, and the governance tier as conditional templates

- **Date:** 2026-07-02
- **Status:** Accepted (supersedes ADR-0001's numbered-template scheme; supersedes ADR-0003's deferral of Tier C/D)
- **Context:** FMD was run on a real hackathon build, and a fresh public-repo crawl of CJ Dela Torre / Axon-Enjin (`drowzi` `INIT.md`; `mate` `Mate.md`+`TASK.md`+`KPMG.md`; `matrix` `MATRIX.md`+data-sources) surfaced concrete gaps (see `founder-knowledge-base/02-playbooks/fmd-learning-guide.md` and `IdeaForge/FINDINGS-seed-refactor.md`):
  - **Numbered filenames confuse.** Only a subset of docs is generated per build, so `01-…14-` leaves gaps ("where's 02?"). CJ uses unnumbered slugs (`prd-mate.md`); ordering lives in the manifest/index, not filenames. Even CJ's `DSD` drifted meaning across repos → doc-type definitions must be pinned.
  - **No single seed schema.** CJ feeds a *set* of rich input docs sized to the build. Our single problem-pure `idea.md` structurally can't ground a DSD (no brand input) or a credible GTM (no market input).
  - **Fixed 5-doc MVP set was too thin** for graded/team builds, and there was no intake to size it. CJ picks the set by project scale.
  - **Build-phase leverage missing.** FMD stopped at docs and handed the coding agent nothing but `AGENTS.md` — no subagent roster, no phased build plan.
  - **Honest caveat:** the "stack-currency register" adopted in ADR-0003 was NOT found in any crawled CJ repo; its attribution to CJ is unproven and may be our own invention. Kept regardless (it earns its place), but no longer credited to CJ.
- **Decision (breaking → major bump 3.1.0 → 4.0.0):**
  1. **Remove numbering.** Rename all numbered templates to unnumbered slugs (`01-brd.md`→`brd.md` … `14-methods.md`→`methods.md`; `_index`→`index`, `_adr`→`adr`). Ordering stays in `manifest.json` `dependsOn` + the emitted `index.md`. Pin a one-line canonical definition per doc type in the manifest.
  2. **Seed set (new input contract).** `idea.md` stays problem-pure + `F-###` spine; optional sibling seeds (`brand`, `market`) + a machine-readable **context block** — all authored upstream by IdeaForge — feed the richer docs. IdeaForge-side changes tracked in `IdeaForge/FINDINGS-seed-refactor.md`.
  3. **Context intake + doc-selection model.** Orchestrator step 0 gathers build context (team size, solo/team, hackathon/graded/company, time budget, judged?, computes-numbers?, exposed-surface?) and selects the doc set. Two modes: **auto** (rules propose the set, human confirms — default) and **learning** (human picks with reasoning; AI critiques against a cost/value/need rubric and is explicitly allowed to affirm "your set is right").
  4. **Adopt build-phase docs.** `sad` (Subagents Document → materializes `.claude/agents/*.md`; anti-sprawl 3–6, model tiers fast/balanced/deep) and `implementation-plan` (phase-gated build order, the spec→code bridge).
  5. **Adopt cheap docs.** `postmortem`, `onboarding`, `rfc`; plus **north-star collapse** as a scoping option (one vision doc owns BRD+MRD at small scale).
  6. **Governance tier is CONDITIONAL, not deferred.** `change-record` (+ Draft→Locked→Superseded lifecycle), `ops`, and merge-gate guardrail agents are built as templates but only selected by the intake for team/multi-day builds. A solo hackathon never generates them → the v3.0 anti-friction stance is preserved.
  7. **Reconcile mode on `consistency-checker`.** Given a human/teammate edit to a feature/ID in one doc, propagate across all referencing docs and report contradictions (the living-docs half of the maintenance loop).
- **Consequences:**
  - *Easier:* no numbering confusion; the doc set is sized to the build; build-phase leverage (agent roster + phased plan); governance is available without imposing friction on small builds.
  - *Breaking:* numbered paths are gone — anything referencing `01-…14-` must migrate; the seed-set input contract is new.
  - *Owed:* IdeaForge must implement seed-set authoring (see FINDINGS doc); validate v4.0 on the next real build; decide the open questions in the FINDINGS doc (context block location, seed folder layout).
