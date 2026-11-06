# agents/ — two audiences, do not confuse them

This folder serves **two different readers**. Keeping them separate is the whole point.

```
agents/
├── ORCHESTRATOR.md     # AUDIENCE 1: the agent RUNNING the factory. Read first.
├── README.md           # this file
└── product/            # AUDIENCE 2: context files EMITTED to the target project root
    ├── AGENTS.template.md   # filled from idea.md + system design → target root AGENTS.md
    ├── CLAUDE.md            # pointer → AGENTS.md
    ├── .cursorrules         # pointer → AGENTS.md
    └── cursor-rules/        # scoped *.mdc templates (globs + frontmatter)
        └── example.mdc
```

## Audience 1 — run the factory (`ORCHESTRATOR.md`)

The operating brain. How to read `idea.md`, validate it, pick the doc set, generate in
dependency order, run the QA loop, and know when to stop. This file is **never emitted** to a
target project — it stays in `fmd/`. An agent generating docs reads it first.

## Audience 2 — the generated product's context files (`product/`)

What the factory **emits into the built project's root** so *that* project's coding agents
behave consistently. These are templates with `{placeholders}` the orchestrator fills. When the
conditional implementation plan is selected, `AGENTS.md` also points every tool at the same living
`TASK-###` state + checkpoint/branch/PR/conflict protocol. When a plan is selected, it also carries
the terminal-managed GitHub Issue/Project projection; it does not execute tasks or make remote
GitHub mutations without an explicit apply step.

### The one-file, many-tools pattern

Write the real content once in `AGENTS.md`. Other tools get thin pointers:

| Tool | File | Content |
|------|------|---------|
| Tool-agnostic | `AGENTS.md` | The real content (source of truth). |
| Claude Code | `CLAUDE.md` | Pointer → `AGENTS.md`. |
| Cursor | `.cursorrules` + `.cursor/rules/*.mdc` | Pointer + scoped rules. |

[AGENTS.md is the tool-agnostic standard](https://agents.md) the ecosystem converged on.
_Content was rephrased for compliance with licensing restrictions._

### Why scoped `.mdc` rules exist

`AGENTS.md` is loaded **every turn** in the target repo, so it must stay lean (≤ ~200 lines) —
bloat taxes every interaction. Path-specific detail goes into scoped Cursor rules
(`cursor-rules/*.mdc`) that load **only when a matching file is in context** (via `globs`
frontmatter). That's the token-budget engine: always-on stays small, depth loads just-in-time.

Keep substance in `AGENTS.md` + `/docs` links; keep each `.mdc` dense and imperative.
