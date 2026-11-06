# ReconLens — Agent Guide

<!--
EMITTED to the target project root by the factory, from agents/product/AGENTS.template.md,
filled from idea.md + the system design. This is what "good output" looks like. Loaded every
turn — kept lean; depth lives in /docs.
-->

## Project overview
ReconLens is a reconciliation tool that auto-matches the easy 95% of transactions and surfaces
only the flagged exceptions for review. It serves the solo finance-ops person at a small fintech
who loses hours hand-matching statements.

## Architecture
A web app + API (the only exposed surface), a deterministic match engine, a relational DB, and
object storage for uploaded CSVs. Matching is rule-based and auditable, not ML.
See [System Design](./docs/system-design.md).

## Build & run
```
make install
make dev
```

## Test
```
make test
```
All changes must pass tests before they're considered done.

## Code style & conventions
- Language / runtime: TypeScript (Node) + a typed SQL layer
- Formatting: project formatter (`make fmt`)
- Naming & patterns to follow: pure functions for the match engine; account-scoped queries always
- Patterns to avoid: ML/LLM in the match path (must stay deterministic + auditable); client-trusted account ids

## Do not touch
- `db/migrations/` (append-only; add new migrations, never edit old)
- secrets / `.env`
- the append-only Resolution write path (BR-004)

## Definition of done
- Build passes, tests pass.
- Traceability preserved: code ties to an `F-###`; that `F-###` has a test in the QA plan.
- No secrets committed; the API enforces auth + account scoping on every endpoint.
- Financial data (amounts, ids, CSVs) never logged.

## References
- [Docs index](./docs/index.md) — **read first**; §0 says which doc owns which fact
- [PRD](./docs/prd.md) — features `F-001..F-004`, rules `BR-001..BR-004`
- [System Design](./docs/system-design.md)
- [Data Model](./docs/data-model.md)
- [Security & Compliance](./docs/security-compliance.md)
- [QA Test Plan](./docs/qa-test-plan.md) — traceability matrix
