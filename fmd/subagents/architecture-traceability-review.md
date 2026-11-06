# Subagent — Architecture and traceability suite review

Run once across the selected document suite after deterministic checks.

Check only:

- PRD → system design → data model → QA paths are coherent;
- feature/invariant IDs have required downstream traces;
- implementation plan tasks and gates point to real product/test IDs;
- selected security/operations/API documents agree with the canonical architecture owner.

Return affected paths and exact trace/ownership conflicts. Regenerate only the architecture and
traceability cluster. After two failed repair cycles, escalate to the lead. Do not re-evaluate the
market, evidence truth, or build decision.
