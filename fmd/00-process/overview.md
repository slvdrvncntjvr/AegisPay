# Process Overview — (optional idea authoring) → idea.md → /docs

FMD is **Stage 5 only**: it takes an `idea.md` and generates `/docs`. Everything before it —
capturing a problem, validating it, sizing a market, writing the brief — is **optional upstream
authoring** that FMD neither runs nor requires. Do as much or as little of it as your situation
warrants. For a hackathon, you might do none of it and draft `idea.md` in one sitting; for a
company bet, you might do all of it via the idea-kit.

> **Where the line is.** Stages 1–4 are **optional** (the idea-kit is one way to do them). They
> are documented here for context only. **FMD is the factory: Stage 5.** It starts at an
> `idea.md`, grounds generation in whatever the brief contains, and **never reaches back into —
> or demands — authoring/validation.**

```
Stage 1        Stage 2          Stage 3            Stage 4         Stage 5
Problem    →   Validation   →   Market Research →  idea.md     →  Generate /docs
(capture)      (is it real?)    (how big/where?)   (the brief)    (run the factory)
   └──────────── ALL OPTIONAL upstream authoring ─────────┘        └── FMD (required) ──┘
```

## Stages 1–4 — optional upstream authoring · _idea-kit or hand-written_

Capture a problem, optionally validate it (talk to people; distinguish what they *say* from what
they *do*/*pay*), optionally size the market, and write `idea.md`. **None of this is enforced by
FMD.** Use the idea-kit if you want the validation discipline; skip it entirely if you're moving
fast. The only thing that matters to FMD is that `idea.md` ends up structurally complete enough
to ground on (see Stage 5 gate).

## Stage 5 — Generate /docs (run the factory) · **← FMD starts here**

Point the agent at `agents/ORCHESTRATOR.md` and the **seed set** (`idea.md` + optional
`brand`/`market` siblings + a `context` block). It runs a **context intake** (step 0) that sizes
the doc set to the build, a structural preflight, then produces `/docs`: the selected set for this
build. See `docs-generation.md`.

- **Gate:** the structural preflight passes (the brief has a feature set with `F-###` IDs and the
  sections the MVP docs read); every generated doc traces to `idea.md`; every `F-###` has a test
  in the QA plan. The preflight checks *structure*, never the idea's *merit* — it does not judge
  evidence, market, or validation, and it never refuses to run.

## MVP vs Final (product scope, not a fixed execution phase model)

The MVP/Final split runs through stages 4–5: it decides **what belongs in scope**. It does not force
an implementation sequence. When selected, the living implementation plan derives vertical slices
and execution waves from dependencies, risk, team capacity/write scopes, remaining time, and the
core demo journey. The MVP docs cover the smallest thing that lets a real user get the core value
and gives you a learning signal; the final set is scaffolding you grow into, not the starting line.
See `playbooks/mvp-vs-final-scoping.md` and `templates/implementation-plan.md`.
