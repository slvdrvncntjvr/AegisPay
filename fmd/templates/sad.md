# SAD — Subagents Document

> **Purpose:** define the small roster of **build-time** AI agents this project needs, so the
> coding phase has specialized workers instead of one general agent. Platform-agnostic: this doc
> **materializes** into `.claude/agents/*.md` (Claude Code) or Cursor equivalents.
> Traces back to: `system-design`, `implementation-plan`.
> **Not the same as** FMD's own factory subagents — this is the *product's* build crew.
> **Living doc — reconcile on pivot.** This roster drifts out of usefulness when the build's
> decisions move and it doesn't. When a pivot changes the architecture or scope (logged in
> `docs/DECISION-LEDGER.md`), re-run the reconciler over this doc so the crew still matches reality;
> a build layer that lags the decisions is exactly why a prior build reached for ad-hoc specs
> instead. At least one agent's guardrails should encode the relevant `INV-###` hard rules (as hard
> negatives) so the crew cannot build a breach.

## Roster rules (anti-sprawl)

- **3–6 agents max.** Each must justify its slot by exactly one of: **repeated-spawn** (you'd
  invoke it many times), **context-offload** (it does heavy work in isolated context), or
  **guardrail-enforcement** (it blocks a class of mistake). Log any agent you rejected and why.
- Least privilege: give each agent the **minimum** `tools`. A reviewer/auditor gets `read` only.
- Model tiers map to concrete models at compile time: **fast · balanced · deep**.

## Agent entries

<!-- One block per agent. This compiles to a .claude/agents/<name>.md file. -->

### <agent-name>
- **name:** `<kebab-name>`
- **description:** <one line: WHEN to invoke this agent>
- **tools:** [read | write | shell | ...]  <!-- least privilege -->
- **model:** fast | balanced | deep
- **Purpose:** <the one job it owns>
- **Inputs:** <what it reads>
- **Outputs:** <what it returns / writes>
- **Guardrails (never):** <the things it must never do — write these as hard negatives>
- **Done when:** <its completion condition>

### <agent-name-2>
- ... (repeat)

## Materialization

<!-- How this doc becomes real agent files. -->
- Target: `.claude/agents/<name>.md` (frontmatter: `name`, `description`, `tools`, `model`; body:
  Purpose / Inputs / Outputs / Guardrails / Done-when).
- Model mapping (default): `fast → haiku`, `balanced → sonnet`, `deep → opus` (adjust per stack).
- Re-materialize whenever this doc changes; never hand-edit the generated files.
