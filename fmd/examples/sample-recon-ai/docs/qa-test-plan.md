# QA — Test Plan (ReconLens MVP)

> Worked example. The traceability home. Every `F-###` from idea.md §7 / the PRD has ≥1 test.

## Test strategy
Unit tests for the match engine (BR-001/BR-002) and append-only resolutions (BR-004);
integration tests for import → match → queue → resolve; one e2e happy path for UJ-001.
Automated, run on every change.

## Scope
### In scope
F-001 import, F-002 auto-match, F-003 exception queue, F-004 resolve; BR-001..BR-004.
### Out of scope
Auth provider internals; processor API connectors (final-product); load testing (MVP load trivial).

## Environments
Local + CI against an ephemeral DB and a stubbed object store. Synthetic CSVs only — no real
financial data. Secrets referenced from CI vault, never inline.

## Traceability matrix

| F-ID  | Feature | Test case ID(s) | Type | Status |
|-------|---------|-----------------|------|--------|
| F-001 | Import two statements | TC-001, TC-002 | unit, e2e | todo |
| F-002 | Auto-match rows (BR-001) | TC-003, TC-004 | unit | todo |
| F-003 | Exception queue (BR-002) | TC-005 | integration | todo |
| F-004 | Resolve an exception (BR-004) | TC-006, TC-007 | integration | todo |

## Test cases

### TC-001 — Well-formed CSVs import with correct counts
- **Covers:** F-001
- **Preconditions:** authenticated ops user, an open period.
- **Steps:** upload ledger.csv (100 rows) + processor.csv (100 rows).
- **Expected result:** row counts shown as 100 / 100; no error.

### TC-002 — Malformed CSV shows a column error, not a crash
- **Covers:** F-001
- **Steps:** upload a CSV missing the amount column.
- **Expected result:** specific "missing column: amount" error; nothing imported.

### TC-003 — Rows within tolerance match (BR-001)
- **Covers:** F-002 (BR-001)
- **Steps:** match rows equal in amount within fee tolerance and within the settlement window.
- **Expected result:** matched and excluded from the exception queue.

### TC-004 — Match summary conserves rows
- **Covers:** F-002
- **Expected result:** matched + exceptions = total processor rows (no row lost or double-counted).

### TC-005 — Every non-matched row appears once with one reason (BR-002)
- **Covers:** F-003 (BR-002)
- **Expected result:** the queue lists each unmatched row exactly once, each tagged with exactly
  one of `no-amount-match` / `ambiguous-multiple-candidates` / `timing-gap` / `possible-duplicate`.

### TC-006 — Resolving removes from open queue
- **Covers:** F-004
- **Expected result:** a resolved exception leaves the open queue; period becomes closeable only
  when none remain open (BR-003).

### TC-007 — Resolutions are append-only (BR-004)
- **Covers:** F-004 (BR-004)
- **Steps:** resolve, then "change" a resolution.
- **Expected result:** a new resolution record is appended; the prior record is unchanged (no
  UPDATE/DELETE).

## Acceptance criteria
All MVP features pass their mapped cases; BR-001..BR-004 each have a covering test; no open
critical defects.

## Regression plan
Full suite on every change; small enough to run in full.

## Exit criteria
Every `F-###` has a passing test; e2e UJ-001 green; append-only invariant (BR-004) proven.
