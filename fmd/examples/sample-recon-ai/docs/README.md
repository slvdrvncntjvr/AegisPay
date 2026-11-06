# ReconLens — /docs (complete worked example)

Generated from `../idea.md` by the FMD factory, sized by `../context.md`. This is the reference
for "what good output looks like" — a complete MVP doc set with traceability flowing end to end.

- **FMD version:** 4.0.0
- **Domain:** fintech / AI / data
- **Doc naming:** unnumbered slugs; order lives in the manifest `dependsOn` + `index.md`, not filenames.
- **Doc set (selected by `../context.md`):** `index` → `idea` → `prd` → `system-design` →
  `data-model` → `qa-test-plan` → `security-compliance` (the last because the API is exposed).
- **Read first:** [`index.md`](./index.md) — §0 source-of-truth map (one fact, one home).
- **Emitted to project root:** [`../AGENTS.md`](../AGENTS.md)

## Traceability you can follow

```
idea.md §7  F-001..F-004
   └─► PRD  feature list (F-001..F-004) + business rules (BR-001..BR-004) + journey (UJ-001)
            └─► QA test plan  every F-### has ≥1 TC; BR-001..BR-004 each covered
system design ─► exposed API surface ─► security & compliance (auth + STRIDE)
data model    ─► append-only Resolution enforces BR-004
```

Security & compliance is included because the system has a network-exposed surface — the
manifest's `condition` for that doc, resolved by the context intake. Everything else is the
always-on core set.

> **What a larger/graded build would add** (via the context intake): `gtm`, `sad` (build-agent
> roster → `.claude/agents/`), `implementation-plan`, `design-system`, `onboarding`. This example
> stays at the MVP spec set on purpose.
