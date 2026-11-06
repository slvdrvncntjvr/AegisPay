# Subagent — Product and claims suite review

Run once across the selected document suite after deterministic checks. This is not product
validation and does not decide whether the lead should build.

Check only:

- product intent, scope, and external-facing language agree with the seed and selected docs;
- external claims are grounded in the seed/codebase or marked as assumptions;
- the core demo, constraints, and pitch material do not contradict the PRD.

Return affected paths, exact contradictions/unsupported statements, and an explicit note of what
remains human-verified. Regenerate only the affected product/claims cluster. After two failed
repair cycles, escalate to the lead. Do not review architecture internals unless they create a
user-facing claim conflict.
