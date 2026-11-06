# AegisPay — coding agent guide

## Start here

Read [docs/index.md](docs/index.md), [docs/implementation-plan.md](docs/implementation-plan.md), [docs/DECISION-LEDGER.md](docs/DECISION-LEDGER.md), then the canonical documents needed by the active task. IDEA.md is the original brief; its §23 addendum supplies stable IDs. The generated docs settle its open routine implementation choices.

This is a quick solo Testnet MVP. Infer ordinary implementation details within these specs and continue without repeated intake. Do not invent external credentials, official rules, SDK methods, successful tests or chain evidence. No multi-agent crew is configured.

## Execution boundary

FMD is the documentation/task framework. The coding agent builds the application. The initial workspace has no app/package/lockfile and no live payment evidence. A documentation check is not an application test.

When implementation is requested, start the earliest ready task. TASK-001 creates only the pinned SDK/runtime harness; TASK-002 proves the actual same-transaction Noir/Velo path before dashboard work. Use the selected stack and layout in system design. Do not replace this with a new architecture exercise.

## Build and test

Available documentation commands:

```text
python tools/check-docs.py
python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict
```

Future package scripts and their exact acceptance purpose are in QA/onboarding. Implement them before running them. Lock exact package versions and verify pinned-version official APIs; no forced peer dependency overrides. Noir 0.3.0 needs Stellar SDK 16.x. Use Node runtime for SDK routes; do not use stale `next lint` commands.

## Task checkpoints and delivery

- Task statuses: ready, in_progress, blocked, done, cut. Do not use older FMD `in_review` examples. Current template/checker takes precedence over stale framework prose.
- One executor claims a ready task, records branch or equivalent work ref and exact observed gate evidence. The active executor also performs plan-steward duties; no separate keeper approval ritual is needed.
- After kickoff establishes local Git tracking, use `task/TASK-###-slug` from the actual local default branch. Remote GitHub delivery is not configured; no PR/Issue/Project is required for local progress.
- Checkpoint task state and dependency readiness at task events/session end; append factual run evidence when a build starts. Never mark done from a planned command or chat alone. The plan owns task status; do not create tasks.md.
- Respect declared scope. Update canonical docs only when intent changes. New tasks get new IDs. Preserve history. Significant choice/pivot/invariant changes go in the ledger; locked-spec changes also get a change record.
- Resolve conflicts from canonical intent, never blanket ours/theirs. Run targeted gates; record/escalate after three unsuccessful repairs.

## Payment rules

Preserve every PRD invariant. Model output is untrusted intent. Use integer amounts, immutable quotes, persisted increasing nonce, atomic budget reservation and exactly one financial handoff. Persist Velo reservation identity before dispatch. Unknown remains unresolved and unentitled; observe by identity rather than sign or submit again.

Verify successful Velo execution and independent matching Noir envelope/invocation/event. Event alone lacks asset/agent fields. Keep inner/outer/event transaction hashes distinct until mapped. Authorize credits merchant-pending escrow; claim is separate. Local/simulation refusal is not an included failed transaction.

Never insert fabricated success records into the live evidence namespace, bypass verification to make a demo green or silently add an unrelated checkout as proof of Noir authorization.

## Security and hygiene

Keep keys server-only and out of model, browser, logs and source control. No secret values or signed agent XDR in evidence. Protected fixture reports stay out of client bundles and unauthenticated responses. Auth/ownership/origin/body rules apply to all declared routes. Testnet only; no mainnet or custom contract redeploy.

Do not modify fmd/ to satisfy a product documentation gap. Record kit inconsistencies in document review. Decision-ledger hook is emitted in hooks/ and can be installed after Git setup; it is not installed in this preparation session.

## Definition of done

The active task's real gate passes, work ref/evidence and dependencies are reconciled, requirement IDs resolve, affected invariants still hold, and documentation checks pass. Claim the complete live MVP only after QA's release gates pass. Missing external inputs block only dependent integration work; report exact missing names and continue useful independent authorized work.
