---
# FMD context block — schema 1.0.0 (ReconLens worked example)
team_size: 2
mode: team
build_type: company        # early product MVP, not a hackathon
time_budget: 2w
judged: false
computes_numbers: false    # matching is deterministic rule-based, not derived/glass-box numbers
exposed_surface: true      # a web app + API
outlives_demo: false       # MVP; not yet operated in production
selection_mode: auto
---

# Context intake — why this doc set

This block is what the orchestrator read at step 0 to size ReconLens's doc set.

**Selected (auto mode):**
- Always: `context` · `index` · `idea` · `prd` · `system-design` · `data-model` · `qa-test-plan`
- `exposed_surface: true` → **+ `security-compliance`**

**Not selected (and why):**
- `methods` — `computes_numbers: false` (deterministic matching, no derived numbers to trace).
- `gtm` / `onboarding` — `judged: false`, small team.
- `sad` / `implementation-plan` — this example demonstrates the **spec set**; for the build phase
  you would add both (see the workflow example in the FMD README / learning guide).
- `brd` / `mrd` — below company-suite scale; vision lives in `idea.md` (north-star collapse).
- `change-record` / `ops` — not team-multi-day governance; does not outlive the demo yet.
