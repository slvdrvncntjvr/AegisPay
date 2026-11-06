# Change Record — CR-### <short title>

> **Purpose:** an append-only log entry for a change to a **Locked** doc. Governance for
> multi-day / team builds only — a solo hackathon does not need this (the intake won't select it).
> Distinct from an ADR: an ADR captures a *decision's* rationale; a CR records that a locked
> spec *changed*, what, and why. Never edit a past CR — supersede it with a new one.

## Doc lifecycle (why CRs exist)

Docs move **Draft → Locked → Superseded**. While `Draft`, edit freely. Once `Locked` (agreed,
being built against), an edit REQUIRES a CR so contributors know the spec moved and why. A
`Superseded` doc is replaced, not deleted.

---

## CR-### — <title>
- **Date:** YYYY-MM-DD
- **Author:** <who>
- **Doc(s) changed:** <slug(s) + section(s)>  ·  **Lifecycle:** Locked → Locked (amended) | → Superseded by <doc>
- **Change:** <what changed, precisely — old → new>
- **Reason:** <why; what reality diverged from the spec>
- **Impact / propagation:** <which other docs or `F-###`/`API-###` refs must reconcile — hand to
  the consistency-checker reconcile pass>
- **Consequences:** <what this makes easier/harder downstream>
