# Documentation Index — {project_name}

**Maintained by:** {owner}
**Last updated:** {date}
**FMD version:** {fmd_version}

<!--
EMITTED to the target project's `docs/index.md`. The orchestrator builds §0 and §1 from the doc
set it actually generated — one row per generated doc, dropping rows for docs not present. Read
this FIRST in any session: §0 says which single doc owns which fact. Doc files are unnumbered
slugs (prd.md, system-design.md, …); ordering is not encoded in filenames.
-->

## 0. Source-of-truth map (one fact, one home)

To stop drift and context-poisoning, **each concern has exactly one canonical owner.** Every
other doc *links* to it — it never restates it. **When two docs disagree, the canonical owner
wins** until the loser is reconciled. Each row also carries the doc's one-line definition (pinned
in `manifest.json`) so a slug never drifts in meaning.

| Concern | Canonical owner | Note |
|---------|-----------------|------|
| Decisions/pivots · rejected choices · names/immutable IDs · decision assumptions | [Decision Ledger](DECISION-LEDGER.md) | append-only decision history; reconcile accepted implications into the concern's canonical doc in the same checkpoint |
| Vision · problem · who it's for | [idea.md](../idea.md) | the seed brief this suite was generated from |
| What we build (features `F-###`, journeys `UJ-###`, invariants `INV-###`) | [PRD](prd.md) | stable feature IDs + hard must-never rules; origin of the spine |
| How it's built (architecture, components, trade-offs) | [System Design](system-design.md) | — |
| Data schema · entities | [Data Model](data-model.md) | — |
| Every computed number (equation + inputs + confidence) | [Methods](methods.md) | glass-box ledger — **only if the product computes numbers** |
| UI · components · states · routes | [Design System](design-system.md) | grounds in the brand seed |
| Tests · traceability (every `F-###` → ≥1 test) | [QA Test Plan](qa-test-plan.md) | the traceability home |
| Security · auth/authz · compliance | [Security & Compliance](security-compliance.md) | **only if a network surface is exposed** |
| Build crew (agent roster) | [SAD](sad.md) | materializes to `.claude/agents/*.md` |
| Live execution state (`TASK-###`, dependencies, owners, scopes, status, gates) and its optional GitHub Issue/Project projection | [Implementation Plan](implementation-plan.md) | dependency-derived waves + checkpoint protocol; Markdown is canonical, no duplicate `tasks.md` |
| Market · positioning | [MRD](mrd.md) | or folded into a north-star at small scale |
| Release · GTM | [Release / GTM](release-gtm.md) | judges read this |
| Pitch · narrative · Q&A ownership · probe sheet | [Pitch Kit](pitch-kit.md) | judged builds only; consumes the rubric from the context block |
| Significant decisions (the *why*) | [ADRs](adr/) | append-only; supersede, never edit |
| Changes to Locked docs | [Change Records](change-record.md) | team/multi-day builds only |

**The rule:** a fact lives in its canonical doc; everything else links to it. Do not restate a
fact owned elsewhere — restating is how two copies drift and the agent hallucinates a merge.

> Emit ONLY the rows for docs that actually exist (the context-selected set). Add a row when a doc
> comes online; never list a doc that isn't generated.

## 1. Document suite (what exists, what's stale)

| Document | File | Status | Last updated |
|----------|------|--------|--------------|
| PRD | [prd.md](prd.md) | {status} | {date} |
| System Design | [system-design.md](system-design.md) | {status} | {date} |
| Data Model | [data-model.md](data-model.md) | {status} | {date} |
| QA Test Plan | [qa-test-plan.md](qa-test-plan.md) | {status} | {date} |
<!-- + one row per additional generated doc (methods, security-compliance, gtm, sad,
     implementation-plan, onboarding, design-system, …). -->

## 2. Health check (run before calling the suite "done")

- [ ] Every `F-###` in the PRD has ≥1 test in the QA plan (consistency-checker T1).
- [ ] No doc restates a fact owned by another (§0 respected).
- [ ] Every network-exposed surface declares auth/authz (Security doc present if so).
- [ ] If the product computes numbers: every displayed number cites an `EQ-###` from Methods.
- [ ] If a SAD exists: the roster materialized to `.claude/agents/*.md` (≤6 agents).
- [ ] If an implementation plan exists: its deterministic checker passes (T6); task refs/gates
      resolve and its ready/blocked view matches dependency state.
