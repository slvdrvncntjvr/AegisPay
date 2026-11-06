# ADR-0006 — Benchmark reconciliation: defect fixes, EARS, the Iron Law, and the gstack build-boundary

- **Date:** 2026-07-11
- **Status:** Accepted
- **Version:** FMD 4.1.0 → 4.2.0. Pairs with idea-forge `adr/ADR-0002` (no schema change; the shared
  `idea.md` schema stays 2.1.0).

## Context

Benchmarked the kits against current practice — Anthropic's *Effective context engineering for AI
agents* (context rot; compaction / structured note-taking / sub-agents) and the spec-driven-development
landscape (GitHub Spec Kit, AWS Kiro + EARS, and Garry Tan's **gstack**, a multi-host Claude-Code skill
pack, MIT). Two findings drove this ADR:

1. **The v4.1.0 upgrade shipped three trailing doc-drift defects — under the framework-upgrade skill's
   own discipline.** (a) `FMD-CONTRACT.md`'s frontmatter example still read `schema_version: 2.0.0`;
   (b) the `consistency-checker`'s output contract said "T1–T4" after **T5** (invariant tracing) was
   added to its criteria; (c) the skill's own body + `boundary-and-ownership.md` asserted the
   (already-closed) `1.1.0`-vs-`2.0.0` fork as *live*. These **are** the prove-on-real-use signal that
   the skill's verify-gate had a hole.
2. **gstack is a proven, IDE-agnostic build→ship loop** (used daily; grew 6→30+ commands from real use;
   runs on 10 hosts). It overlaps FMD's *aspirational* build half (ARCHITECTURE §8–§11) but is
   battle-tested where FMD's is sketched. Constraint: the owner's team is multi-IDE (Claude, Gemini,
   Cursor, …); gstack supports 10 hosts **but not Gemini**.

## Decision

1. **Fixed the three defects**; hardened the `framework-upgrade` skill's *verify-before-done* gate with
   two deterministic checks — a **version-string sweep** and an **ID-class / check-set completeness**
   grep across output contracts — plus "run the gates, don't just read them," and added **negative
   triggers** to the skill description.
2. **EARS** (Easy Approach to Requirements Syntax) borrowed into `prd.md` and `qa-test-plan.md` as
   **GUIDANCE** (solution-space): acceptance criteria as "WHEN … the system SHALL …"; INV-### negative
   tests as the unwanted-behaviour form "the system SHALL NEVER …". Phrasing makes the test writable;
   enforcement is still the QA case + consistency-checker. **No schema change.**
3. **Iron Law** borrowed from gstack's `/investigate` into the reconciler discipline (ARCHITECTURE §10):
   no fix without investigation; stop after 3 failed attempts on the same conflict; escalate, never thrash.
4. **Build-boundary decision:** FMD **hands off at the doc boundary.** It does **not** build a
   `tasks.md` / build / review / QA layer — that is the coding agent's or gstack's job. ARCHITECTURE
   §8–§11 are **not** to be rebuilt as machinery; borrow gstack's proven patterns instead.
5. **Marked ARCHITECTURE §3–§4's maturity/confidence two-axis model explicitly aspirational** (not
   shipped); deferred the migration until a real build shows the friction `status: frozen` can't express.

## Options considered

- *Mandate gstack as the team's build layer.* **Rejected** — it doesn't support Gemini (a teammate's
  agent) and is a heavy dependency; it would fracture a multi-IDE team. Instead the **shared, mandatory
  layer stays FMD's IDE-agnostic `AGENTS.md` + docs** (which reach every agent, Gemini included);
  gstack-capable teammates may run it personally; the highest-value patterns are encoded IDE-agnostically.
- *Copy gstack's LLM-judge numeric gates (`/spec` 7/10, `/cso` 8/10) and multi-model juries (`/codex`,
  `gstack-model-benchmark`).* **Rejected** — on the deliberately-rejected list (false precision;
  cost/keys a solo/student team lacks). Kept the deterministic linter + ordinal C0–C3 + the INV-###
  spine, which gstack lacks and which matter more for Soroban/Rust/fintech.
- *Build FMD's own tasks/build layer now.* **Deferred** — gstack + the coding agent already own
  build→ship; FMD's value is the pre-build docs + the deterministic guardrail that rides on top of any
  build loop.

## Consequences

- **Easier:** the shipped docs are internally consistent again; the skill's gate now catches the exact
  drift class that shipped in v4.1.0; INV-### tests are unambiguous (EARS); the design-of-record no
  longer presents an unshipped schema as real.
- **Owed / unproven:** every borrow is GUIDANCE until run on a real build. The honest next test is one
  hackathon end-to-end (idea-forge → FMD docs → gstack/agent build), logging where the docs help versus
  where they collide with gstack's judge-gates.
- **Boundary intact:** no `idea.md` schema change; EARS lives in FMD output templates; the build loop is
  delegated, not absorbed.
