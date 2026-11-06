# System Design — ReconLens (MVP)

> Generated from the PRD by the `architect` subagent. Worked example.

## Context diagram

```
[Ops browser] ──► [Web app + API] ──► [Match engine]
                       │                    │
                       ├──► [Relational DB] (periods, rows, matches, resolutions)
                       └──► [Object storage] (uploaded CSVs)
                       │
                  [Auth provider]
```

## Components & responsibilities
- **Web app + API:** auth, file upload, triggers matching, serves the exception queue and
  resolution endpoints. The only network-exposed surface.
- **Match engine:** implements BR-001 fuzzy matching; assigns BR-002 exception reasons. Pure
  function over two row sets — no external calls.
- **Relational DB:** periods, imported rows, matches, append-only resolutions (BR-004).
- **Object storage:** raw uploaded CSVs (sensitive financial data — see security doc).
- **Auth provider:** identity for the single ops user per account.

## Data flow
Upload two CSVs → parse + validate → match engine applies BR-001 → matched rows + exceptions
(BR-002) persisted → queue served to ops → resolution writes an append-only record (BR-004) →
period closeable when no open exceptions (BR-003).

## Key technology choices + rationale

| Choice | Why | Trade-off | Alternative rejected |
|--------|-----|-----------|----------------------|
| Deterministic rule-based match engine (not an LLM) | Auditable, explainable, cheap; BR-001 is expressible as rules | Less "smart" on novel cases | LLM matcher — non-deterministic, hard to audit financial data |
| Relational DB | Append-only resolutions + relational rows | Schema rigidity | Document store — weaker constraints |
| Object storage for raw CSVs | Keep large files out of the DB | Extra component | Store blobs in DB — bloat |

> **Note on "AI-assisted":** the MVP keeps matching deterministic and auditable (BR-001).
> Learned matching (F-102) is a *final-product* feature, deliberately out of the MVP to keep the
> exception queue trustworthy and explainable — directly de-risking idea.md §9.

## Integration points
- Auth provider: login. Failure → block access, show retry.
- No external financial APIs in MVP (CSV import only — mirrors idea.md §10).

## Deployment topology
Single web service + match engine, managed DB + object storage, one prod + one staging.

## Scaling strategy
Reconciliations are per-account and bounded (thousands of rows, monthly). A single instance
handles MVP load. **Assumption:** <1k active accounts year one; matching of ~10k rows completes
in seconds. Revisit if row counts reach millions.

## Trade-offs considered
Chose deterministic matching over ML to protect auditability and the "small, trustworthy
exception queue" the whole product depends on. Logged as ADR.
