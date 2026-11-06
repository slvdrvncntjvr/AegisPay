---
# FMD context block — schema 1.1.0
# The sized inputs that SELECT the doc set, PLUS the competition context for judged builds.
# ONE home for this fact. Authored upstream (IdeaForge) or answered at factory start
# (orchestrator step 0). This is intake, not a generated doc. BOTH kits consume it:
#   - IdeaForge reads it to check the problem is IN SCOPE of the theme (relevance) + to time-box.
#   - FMD reads it to SIZE the doc set and to generate the pitch cluster for judged builds.
# There is deliberately NO "hackathon mode" flag — context is data in the seed.
team_size: 1
mode: solo                 # solo | team
build_type: hackathon      # hackathon | graded | company | production
time_budget: 3h            # rough order of magnitude (e.g. 3h, 2d, 2w)
judged: true               # is it pitched / graded / demoed to judges?
computes_numbers: false    # does the product derive scores, prices, fees, on-chain amounts, risk?
exposed_surface: true      # any network-exposed API / endpoint / auth boundary?
outlives_demo: false       # will it run in production past the demo?
selection_mode: auto       # auto | learning  (see below)

# Competition context — fill ONLY when judged: true. This is the canonical home of the rubric
# (the pitch-deck-playbook and pitch-kit CONSUME these weights; they never restate them).
competition:
  name: <event name>
  theme: <the theme/challenge you're scored on — IdeaForge checks the problem fits this>
  format: <e.g. 5-min pitch + 15-min Q&A + 5-min prep>
  rubric:                  # criterion: weight (must total 100)
    - <criterion>: <weight>
  hard_requirements:       # pass/fail, not scored (e.g. "≥1 Google tech", "public repo")
    - <requirement>
---

# Context intake

<!--
FMD reads this block FIRST (orchestrator step 0), before selecting or generating any doc.
It answers one question: which docs does THIS build actually need? Fill it from the seed set
(IdeaForge) or by asking the human once. Do not generate docs before this is resolved.
-->

## How the fields select the doc set

Start from the always-on core, then add by condition:

| Always (any build) | index · idea · prd · system-design · data-model · qa-test-plan |
|---|---|
| `exposed_surface: true` | + security-compliance |
| `computes_numbers: true` | + methods (glass-box ledger) |
| `judged: true` | + gtm · onboarding (a judge/teammate reads these first) |
| a build crew / tracked implementation is wanted | + sad · implementation-plan (living `TASK-###` execution state) |
| `mode: team` OR `time_budget` > ~1 day | + change-record (Draft→Locked→Superseded) · rfc |
| `outlives_demo: true` | + ops |
| large / company build | + brd · mrd (or ONE north-star doc — see north-star collapse) · frd · srs · technical-design · api-spec · design-system |

**North-star collapse:** below team/company scale, do NOT generate separate `brd` + `mrd`. Generate
one vision doc that owns both, and let the rest of the suite decompose it.

## Selection modes

- **`auto` (default):** the rules above propose a doc set; the human confirms or overrides once.
  Fast — right for a real build under time pressure.
- **`learning`:** the human proposes the doc set *with reasoning*; FMD critiques it against a
  rubric — for each doc: **cost** (tokens/time), **value** (which downstream decision it de-risks),
  **need** (does this build actually require it?). The critique is **allowed and expected to
  affirm** a correct set ("your set is right, ship it") — it must not invent docs to justify
  itself. Use this mode to learn the doc suite, not on a deadline.
