---
status: draft
schema_version: 1.1.0
---

# IDEA: ReconLens — AI-assisted transaction reconciliation for small fintech ops teams

> **Worked example** (fintech / AI / data). This is the factory's "what good input looks like."
> Evidence tags/four-tests below are illustrative and **optional** — FMD grounds on the brief but
> does not require or validate them (ADR-0002).

## 1. Problem statement
Finance-ops people at small fintech and marketplace companies reconcile their internal ledger
against bank and payment-processor statements every month. They export both sides to
spreadsheets and match thousands of rows by hand. Most rows match trivially; the painful 2–5%
are mismatches from fees, timing gaps, partial captures, and duplicates — and finding those few
costs hours of scrolling and VLOOKUPs. Errors slip through and surface later as audit findings.

## 2. Target user / segment
The one finance-ops person (or fractional controller) at a 10–60-person fintech/marketplace
startup that processes money through 1–3 payment processors and has no dedicated accounting
engineering team. They reconcile monthly, sometimes weekly.

## 3. Evidence of the problem
- **Said:** 8 of 11 ops/controllers interviewed call month-end reconciliation their "worst
  recurring task." — _user interviews, 2026-04_
- **Did:** 9 of those 11 maintain a hand-built spreadsheet with VLOOKUP/macro matching that
  breaks when a processor changes its export format. — _observed, screen-shares, 2026-04_
- **Paid:** 3 pay for a heavyweight accounting suite but still export to spreadsheets for this
  step because the suite's matching is too rigid. — _interviews, 2026-04_

| Test            | Pass / Fail | Why |
|-----------------|-------------|-----|
| Real            | Pass | 8/11 name it unprompted as their worst task. |
| Large           | Pass | Definable: solo ops at small money-moving startups. Size band in §5. |
| Significant     | Pass | 4–8 hours/month + audit risk. `[verified — interviews]` |
| Urgent          | Pass | Monthly deadline; close can't finish until recon is done. |

## 4. Root cause (the WHY)
Reconciliation is a *matching* problem with messy, source-specific keys (amounts split by fees,
timestamps offset by settlement lag, IDs formatted differently per processor). Spreadsheets do
exact matching; the real world needs fuzzy, rule-plus-judgment matching. Heavyweight suites
encode rigid rules that break on edge cases, so the human falls back to the spreadsheet. Nobody
has built a tool that auto-matches the easy 95% and puts *human judgment only on the flagged few*.

## 5. Market & alternatives
- **Size band:** tens of thousands of small money-moving startups globally `[unverified — needs sizing]`
- **Reachability:** two fractional-CFO communities, an r/-style accounting-ops forum, a
  fintech-ops Slack group. `[verified — confirmed access, 2026-04]`
- **Top 3 alternatives + their key failure:**
  1. Spreadsheet + VLOOKUP/macros — fails: exact-match only, breaks on format changes, no audit trail.
  2. Heavyweight accounting suite — fails: rigid rules, too costly/heavy for the team, still exports to sheets.
  3. Do nothing / outsource to a bookkeeper — fails: slow, expensive, errors still surface at audit.

## 6. Value proposition
For **the solo finance-ops person at a small fintech** who **loses hours hand-matching
statements**, this is a **reconciliation tool** that **auto-matches the easy 95% and surfaces
only the flagged exceptions for review**, unlike **spreadsheets and rigid suites**, because
**it matches fuzzily and explains why each exception was flagged**.

## 7. Feature set
<!-- F-### IDs are the traceability spine. MVP = F-0xx, final = F-1xx. -->

### MVP — smallest path to core value + a learning signal
- **F-001** — Import two statements (ledger CSV + processor CSV) → solves "manual export/format wrangling" (§1).
- **F-002** — Auto-match rows (fuzzy on amount+date+id) and show a match summary → solves "hand-matching the easy 95%" (§1).
- **F-003** — Exception queue: list only unmatched/ambiguous rows with the reason each was flagged → solves "scrolling to find the painful few" (§1).
- **F-004** — Resolve an exception (confirm match, mark as fee/timing/duplicate, or leave open) → solves "no record of judgment / audit trail" (§4).

### Final product — full vision
- **F-101** — Direct processor API connectors (no CSV export).
- **F-102** — Learned matching rules from past resolutions.
- **F-103** — Multi-processor, multi-currency reconciliation.
- **F-104** — Audit export + sign-off workflow.

## 8. Success metrics
- **Activation:** a team completes one full reconciliation (import → all exceptions resolved) in week 1.
- **Retention:** ≥50% of activated teams reconcile again the next month.
- **Revenue / value:** ≥15% of retained teams convert to paid by month 3.

## 9. Constraints, risks, assumptions
- **Riskiest assumption:** fuzzy auto-matching is accurate enough that the exception queue is
  *small and trustworthy* — if it flags too many false exceptions, it's just a slower spreadsheet.
- **Constraints:** handles financial data → must treat amounts/account identifiers as sensitive;
  no storing of full bank credentials in MVP (CSV import only).
- **Other assumptions:** users will trust an auto-match enough to not re-check the 95%.

## 10. Out of scope (for now)
Direct bank/processor API connections, multi-currency, general ledger/accounting features,
tax, mobile apps, more than two statements per reconciliation.
