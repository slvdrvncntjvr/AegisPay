# PRD — Product Requirements Document

> **Purpose:** the WHAT, for the team. Translates business + market needs into product. The
> team's primary build reference.
> Traces back to: `idea.md` §6, §7; BRD; MRD. Traces forward to: FRD, QA test plan.

## Overview & goals
<!-- What the product is and the outcomes it must achieve. 3–5 lines. -->

## Personas & use cases
<!-- Who uses it and in what situations. Pull from MRD. -->

## User stories
<!-- As a <role>, I want <capability>, so that <benefit>. Group by persona. -->

## User journeys
<!-- Each core journey gets a STABLE ID: UJ-001, UJ-002, … Referenced by QA and design system. -->
- **UJ-001** — <journey name>: <role> does <flow> to achieve <outcome>.

## Feature list (with priorities)
<!--
Each row reuses the F-### ID from idea.md §7. Do NOT invent new feature IDs here — the PRD
inherits them. "Solves" cites the idea.md problem (§1/§3). Every F-### must later appear in
the QA test plan.
-->

| F-ID  | Feature | Priority | Solves (problem) | Notes |
|-------|---------|----------|------------------|-------|
| F-001 |         | MVP      |                  |       |

## Business rules
<!-- Each rule gets a STABLE ID: BR-001, BR-002, … Behavior the system must enforce. FRD/QA reference these. -->
- **BR-001** — <rule>.

## Hard rules / must-never (invariants — `INV-###`)
<!--
The guardrails that must hold across EVERY iteration and pivot. Each mirrors an INV-### from
idea.md §9 (the invariant spine). State them as negative constraints in EARS "unwanted behaviour" form — "the system SHALL NEVER
do X" (or "IF <trigger> THEN the system SHALL <block/refuse>") — because that phrasing is
unambiguous and is what a build breaches by accident under pressure. Each INV-###
must be enforced downstream: a matching security threat mitigation, a design-system banned-copy
line, and a QA NEGATIVE test ("assert the system never does X"). The consistency-checker treats
an INV-### with no negative test as an orphan, exactly like an untested F-###.
These are NOT feature-locks and do not freeze the spec — they are what stays true so the rest can
change. Changing one is a logged pivot in the decision ledger, never a silent edit.
-->
- **INV-001** — the system must never <hard rule, e.g. render or store place-level crime labels>. (Enforced by: security threat T-###, design-system banned-copy, QA negative test.)
- **INV-002** — the system must never <hard rule, e.g. promise real-time rescue / SOS / dispatch>.

## User flows
<!-- Step-by-step for the core journeys. Diagrams welcome. -->

## Acceptance criteria
<!-- Per feature (by F-ID), testable conditions. These become QA cases keyed to the same F-ID.
Write each in EARS (Easy Approach to Requirements Syntax, from Rolls-Royce) — it makes the condition
unambiguous and maps 1:1 to a QA case:
  • Ubiquitous:   "The system SHALL <response>."
  • Event-driven: "WHEN <trigger>, the system SHALL <response>."
  • State-driven: "WHILE <in state>, the system SHALL <response>."
  • Optional:     "WHERE <feature is included>, the system SHALL <response>."
  • Unwanted (used for the INV-### rules above): "IF <trigger>, THEN the system SHALL <mitigation>",
    or the absolute form "the system SHALL NEVER <forbidden behaviour>."
This is GUIDANCE (phrasing that makes a test writable) — enforcement is still the QA case + the
consistency-checker, not the wording. -->
- **F-001:** WHEN <trigger>, the system SHALL <testable response>.

## Non-goals
<!-- What this product deliberately does not do. Mirror idea.md §10. -->

## Dependencies
<!-- Systems, teams, services, data this depends on. -->

## Open questions
<!-- Unknowns to resolve. Never let an open question become a confident guess. -->
