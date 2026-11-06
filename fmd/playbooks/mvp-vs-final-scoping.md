# Playbook — MVP vs Final scoping

How to split the feature set, and which templates each stage needs.

## The MVP cut rule

MVP/Final classifies **product scope**; it is not a fixed execution phase model. When an
implementation plan is selected, its vertical slices and waves derive from the actual dependency
DAG, team skills/availability, disjoint write scopes, current code, risk, and remaining time.

Keep only what's required to:
1. deliver the **core value once** to a real user, and
2. produce a **learning signal** (do they come back / pay / change behavior?).

Everything else is "final." When in doubt, cut. The MVP is the smallest honest test of the
riskiest assumption (idea.md §9), not a small version of the whole product.

## A quick test per feature

For each candidate feature, ask:
- If this were missing, could a user still get the core value? → If yes, it's **final**, not MVP.
- Does it exist mainly to make us comfortable (settings, admin, polish)? → **final**.
- Does it directly test the riskiest assumption? → **MVP**.

## Which docs each build needs (sized by the context intake)

The doc set is **selected per build from the `context` block** (team, time, build type, judged,
computes-numbers, exposed-surface, outlives-demo), not from a fixed list. Templates are unnumbered
slugs; order comes from `manifest.json` `dependsOn`.

| Layer | Docs |
|-------|------|
| **Always (any build)** | `context` → `index` → `idea` → `prd` → `system-design` → `data-model` → `qa-test-plan` |
| **Conditional MVP** | `security-compliance` (exposed surface) · `methods` (computes numbers) · `gtm` + `onboarding` (judged or team) · `sad` + `implementation-plan` (a build crew is wanted) |
| **Team / multi-day** | `change-record` (Draft→Locked→Superseded) · `rfc` (per-feature decisions) |
| **Outlives the demo** | `ops` |
| **Company / large scale** | `brd` + `mrd` (or ONE north-star doc) · `frd` · `srs` · `technical-design` · `api-spec` · `design-system` |
| **After the build** | `postmortem` (human-filled; feeds the kit + LTM) |

> **North-star collapse:** below team/company scale, do NOT generate separate `brd` + `mrd` —
> generate one vision doc that owns both, and let the suite decompose it.
> `index` always emits — it's the source-of-truth map, not a cost.

## Anti-pattern

Generating the full template library regardless of the actual build context. That's the
factory-polishing trap: it feels like progress and ships nothing. Start from the base set, add only
conditions that hold, build, and expand the framework from repeated real friction.
