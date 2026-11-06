# ADR-0005 — Invariant spine, IDE-agnostic keeper, pitch cluster, competition context

- **Date:** 2026-07-10
- **Status:** Accepted
- **Version:** FMD 4.0.0 → 4.1.0. Pairs with idea-forge 2.0.0 → 2.1.0 (see IdeaForge `adr/ADR-0001`).

## Context

The first real winning build (GuidHer / SparkFest) produced a retrospective whose failures were
not random: (D4) a dataset merged that breached a hard product rule, (D5) a UI element shipped that
contradicted a hard rule and the pitch, (D1/D2/D3/D6) the decision log and docs drifted across
branches after generation, and (D7) a rebrand caused standing name confusion that risked renaming
an immutable technical id. The pitch — the thing that actually won — had no home in the kit, and
the competition rubric was never a first-class input ("the doc suite was generated from idea.md and
never ingested the competition rules"). Applying the framework-upgrade skill, each fix was
classified by owner rather than dumped onto FMD.

## Decision

1. **Invariant spine (`INV-###`).** Hard "must-never" product rules originate in `idea.md` §9
   (authored by idea-forge — a *contract* change, not an FMD invention, so the schema is not
   forked) and are carried by FMD into a PRD must-never rule → a security threat mitigation → a
   design-system banned-copy line → a QA **negative** test. `consistency-checker` gains T5 and
   traces invariant orphans like untested features. Invariants are **non-locking**: they survive
   pivots and never freeze the brief; changing one is a logged pivot.
2. **IDE-agnostic keeper.** A new emitted `decision-ledger` template (living, append-only,
   trunk-only: names/immutable-ids, current-truth, pivots, rejected approaches, INV audits) plus
   portable **git hooks** (`agents/product/hooks/`) and a reconcile discipline written into the
   emitted `AGENTS.md`. Enforcement lives at the git layer + AGENTS.md so it holds under Claude,
   Cursor, Gemini, Codex, and Kiro alike — **not** an editor-specific hook. The keeper reconciles
   and flags; it never freezes the spec.
3. **Pitch cluster (judged builds).** `playbooks/pitch-deck-playbook.md` (the VC canon re-weighted
   for a rubric) + `templates/pitch-kit.md` (the filled instance: narrative, BMC→beat, rubric-mapped
   script, Q&A ownership map, probe sheet). Both **consume** the rubric from the context block and
   never restate its weights.
4. **Competition context.** `templates/context.md` gains a `competition` block (rubric weights, hard
   requirements, format) — the single canonical home of the rubric, consumed by FMD (doc-set sizing
   + pitch generation) and by idea-forge (theme/scope check). No "hackathon mode" flag; context is
   data. It does not live inside `idea.md` and does not move based on whether `idea.md` has features.
5. **Schema realignment.** `templates/idea.md` moved 1.1.0 → 2.1.0 to match idea-forge's schema
   (adds `origin`/`payer_status` as optional idea-forge-internal frontmatter FMD does not gate on,
   and the §9 `INV-###` block), closing the known fork flagged in `FMD-CONTRACT.md`.

## Options considered

- *Add kill-criteria/pitch/evidence directly to FMD.* Rejected: forks the shared schema and
  duplicates idea-forge's problem-space capabilities. Invariants and validation are authored
  upstream; FMD consumes.
- *A Kiro `.kiro.hook` for the keeper.* Rejected: fires only inside one editor. Git-layer + AGENTS.md
  is write-once, enforce-everywhere.
- *A freeze/lock gate to stop drift.* Rejected on principle: the brief is never final; we iterate and
  pivot. The keeper makes change coherent, it does not prevent it.

## Consequences

- Easier: hard rules are now mechanically enforced end-to-end; the winning pitch has a home; drift is
  caught at commit time regardless of IDE; the rubric has one owner.
- Harder / owed: FMD now emits more (ledger + hooks + pitch), so the context intake must keep these
  conditional (not always-on) to avoid sprawl. The keeper and pitch cluster are **unproven until run
  on a real build** — that is the next test, per the kit's own honesty rule.
- Deferred: the ARCHITECTURE.md maturity/confidence two-axis model (a separate, larger schema
  migration) is NOT done here; this ADR is consistent with it (non-locking) but does not implement it.
