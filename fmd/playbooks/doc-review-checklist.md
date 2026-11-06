# Playbook — Doc review checklist (the quality gate)

Every generated doc passes this before it's "done." Anything failing goes back for that doc
only. This is the gate in `docs-generation.md` step 6.

- [ ] **Traceable** — ties back to a problem/feature in `idea.md`.
- [ ] **Complete** — all required template sections present (or explicit "N/A — because…").
- [ ] **Grounded** — every material claim traces to `idea.md`, an upstream doc, or the codebase;
      anything else is labeled `[assumption]`. No invented specifics stated as fact.
- [ ] **Consistent** — no contradiction with sibling docs; terms used the same way everywhere.
- [ ] **Single-sourced** — no doc restates a fact owned by another; it links instead (see `docs/index.md` §0).
- [ ] **Glass-box** — if the product computes numbers, every number cites an `EQ-###` + confidence (see `methods.md`); no bare computed numbers.
- [ ] **Scoped** — MVP docs don't smuggle in final-product scope.
- [ ] **Testable** — every feature has at least one QA case in `qa-test-plan`; automated cases name
      an exact path/command and browser UI has a conditional core-journey E2E strategy.
- [ ] **Executable (if a plan exists)** — every `TASK-###` has resolved dependencies, one owner, bounded
      write scope, work ref/status, and a gate; the deterministic plan checker passes; parallel work
      has disjoint declared scopes.
- [ ] **Human** — reads plainly; no AI-slop or filler.
- [ ] **Secure-by-default** — exposed surfaces note their auth/authz; secrets handling addressed.

## Who runs what

| Check | Owner |
|-------|-------|
| Traceable, Consistent, Single-sourced | `consistency-checker` subagent |
| Grounded, Glass-box | `qa-anti-hallucination` subagent |
| Human | `humanizer` subagent |
| Secure-by-default | `architect` / `red-team` subagents |
| Complete, Scoped, Testable | orchestrator + human review |
| Executable living plan | deterministic plan checker (structure) + consistency-checker/human (semantic scope) |
