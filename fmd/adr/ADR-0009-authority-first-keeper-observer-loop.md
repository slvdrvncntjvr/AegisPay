# ADR-0009 — Authority-first CEF learning loop

- **Date:** 2026-07-23
- **Status:** Accepted; effectiveness remains unproven pending closed real runs.
- **Version:** FMD 4.4.0 → 4.5.0. No `idea.md` schema/context change.

## Trigger

The Convex extraction preserved pivots and task state but had no `docs/run-evidence.jsonl`,
`run_closed`, or postmortem. It could not establish whether IdeaForge/FMD helped, caused rework, or
improved the outcome. Separately, the prior GitHub projector lacked run-scoped activation and could
overwrite Issue titles despite claiming to own only generated content.

## Decision

1. A **Build Keeper** is the sole writer of tracked-plan status. It records observed facts in the
   product repository's append-only run ledger, reconciles canonical documents after a confirmed
   pivot, and never makes product strategy or framework decisions.
2. A **Framework Observer** runs only after `run_closed`, writes the product repository's
   postmortem, and proposes `FC-###` trials. It never edits the kits automatically.
3. GitHub remains one-way: Markdown plan → managed Issue block + implementation Project fields. Initial
   activation requires a reviewed mutation digest; active runs may re-project checkpoint changes.
   Sync faults suspend only the projection. Issue titles, comments, labels, assignees, PR discussion,
   and inbound card changes remain human-owned/non-authoritative.
4. Keep the FMD core documents. Replace repeated document-level LLM verification with two targeted
   suite reviews and repair only the affected cluster. Humanization is explicit-only.

## Consequences

- Closed runs can now measure planning time, first slice, consulted documents, rework, demo result,
  and feedback without inventing unknowns.
- This is instrumentation and a reversible operating trial, not proof that the mechanism improves
  outcomes. The lead may disable recording with a reason.
- No generalized harness, webhook, GitHub Action, two-way sync, or automatic framework mutation is
  added. Those remain deferred until real evidence justifies them.
