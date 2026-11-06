# Documentation Index — ReconLens

**Maintained by:** ReconLens team
**Last updated:** 2026-07-02
**FMD schema:** 4.0.0

<!-- Read this FIRST. §0 says which single doc owns which fact. Doc files are unnumbered slugs. -->

## 0. Source-of-truth map (one fact, one home)

Each concern has exactly one canonical owner. Every other doc *links* to it; when two disagree,
the owner wins until reconciled.

| Concern | Canonical owner | Note |
|---------|-----------------|------|
| Vision · problem · who it's for | [idea.md](../idea.md) | the seed brief this suite came from |
| What we build (features `F-001..F-004`, rules `BR-###`, journey `UJ-001`) | [PRD](prd.md) | origin of the ID spine |
| How it's built (match engine, API, DB, storage) | [System Design](system-design.md) | — |
| Data schema · entities · append-only Resolution (`BR-004`) | [Data Model](data-model.md) | — |
| Tests · traceability (every `F-###` → ≥1 test) | [QA Test Plan](qa-test-plan.md) | the traceability home |
| Security · auth · account-scoping · STRIDE | [Security & Compliance](security-compliance.md) | present because the API is network-exposed |

**The rule:** a fact lives in its canonical doc; everything else links. Do not restate.

## 1. Document suite

| Document | File | Status | Last updated |
|----------|------|--------|--------------|
| PRD | [prd.md](prd.md) | draft | 2026-07-02 |
| System Design | [system-design.md](system-design.md) | draft | 2026-07-02 |
| Data Model | [data-model.md](data-model.md) | draft | 2026-07-02 |
| QA Test Plan | [qa-test-plan.md](qa-test-plan.md) | draft | 2026-07-02 |
| Security & Compliance | [security-compliance.md](security-compliance.md) | draft | 2026-07-02 |

## 2. Health check

- [x] Every `F-###` in the PRD has ≥1 test in the QA plan.
- [x] No doc restates a fact owned by another (§0 respected).
- [x] The network-exposed API declares auth + account-scoping (Security doc present).
- [n/a] Product computes no derived numbers → no methods ledger.

> **Not generated for this MVP** (would be added by the context intake for a larger/graded build):
> `gtm`, `sad`, `implementation-plan`, `design-system`, `onboarding`. See `../context.md`.
