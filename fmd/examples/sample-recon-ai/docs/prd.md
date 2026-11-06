# PRD — ReconLens (MVP)

> Generated from `../idea.md`. Worked example. Features reuse the `F-###` IDs from idea.md §7.

## Overview & goals
A reconciliation tool for solo finance-ops people at small fintechs. Goal: auto-match the easy
95% of rows and present a small, trustworthy exception queue, so a full reconciliation takes
minutes of judgment instead of hours of scrolling.

## Personas & use cases
- **Ops/controller (primary):** imports two statements monthly, reviews exceptions, resolves them.

## User stories
- As ops, I want to upload my ledger and processor exports and have them matched automatically,
  so I stop hand-matching thousands of rows.
- As ops, I want to see only the rows that need a human, with a reason, so I spend my time on
  judgment, not search.
- As ops, I want each resolution recorded, so I have an audit trail at close.

## User journeys
- **UJ-001** — Reconcile a period: ops imports two CSVs → reviews the match summary → works the
  exception queue → marks the period reconciled.

## Feature list (with priorities)

| F-ID  | Feature | Priority | Solves (problem) | Notes |
|-------|---------|----------|------------------|-------|
| F-001 | Import two statements (ledger + processor CSV) | MVP | Manual export/format wrangling | CSV only in MVP |
| F-002 | Auto-match rows (fuzzy: amount+date+id) | MVP | Hand-matching the easy 95% | Shows match summary |
| F-003 | Exception queue with flag reason | MVP | Scrolling to find the painful few | Only unmatched/ambiguous rows |
| F-004 | Resolve an exception | MVP | No audit trail of judgment | Confirm / categorize / leave open |

## Business rules
- **BR-001** — A processor row matches a ledger row when amounts are equal within the fee
  tolerance AND dates are within the settlement-lag window AND ids are a fuzzy match. Anything
  short of that is an **exception**, not a match.
- **BR-002** — Every exception carries exactly one machine-assigned reason: `no-amount-match`,
  `ambiguous-multiple-candidates`, `timing-gap`, or `possible-duplicate`.
- **BR-003** — A period cannot be marked reconciled while any exception is unresolved (resolved
  includes "left open with a note").
- **BR-004** — Resolutions are append-only; a resolution is never silently overwritten (audit trail).

## User flows
1. Import: ops uploads ledger.csv + processor.csv → system validates columns → shows row counts.
2. Match: system auto-matches per BR-001 → shows "X matched, Y exceptions."
3. Review: ops opens the exception queue (BR-002 reasons) → resolves each (F-004, BR-004).
4. Close: when no unresolved exceptions remain (BR-003), ops marks the period reconciled.

## Acceptance criteria
- **F-001:** importing two well-formed CSVs shows correct row counts; a malformed CSV shows a
  specific column-level error, not a crash.
- **F-002:** rows meeting BR-001 are matched and excluded from the exception queue; the summary
  count equals matched + exceptions = total processor rows.
- **F-003:** the queue lists every non-matched row exactly once, each with one BR-002 reason.
- **F-004:** resolving an exception removes it from the open queue and writes an append-only
  resolution record (BR-004).

## Non-goals
Direct processor/bank API connections, multi-currency, general accounting, >2 statements per run
(mirrors idea.md §10).

## Dependencies
A managed auth provider; object storage for uploaded files; a relational database.

## Open questions
- What fee tolerance / settlement-lag window defaults are safe across processors? `[open]`
