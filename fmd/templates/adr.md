# ADR — Architecture Decision Record

> Append-only log. One entry per significant decision. Cheap, durable, and the best defense
> against "why did we do it this way?" six months later. Copy the block below per decision; never
> edit a past entry — supersede it with a new one.

## When to add an entry (the gate)

A decision is "significant" — and earns an ADR — only when **all three** hold:

1. **Hard to reverse** — the cost of changing your mind later is meaningful.
2. **Surprising without context** — a future reader will look at the code and wonder "why on
   earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for
   specific reasons.

If any one is missing, **skip the ADR** (an easy-to-reverse or obvious decision isn't worth
recording). Keep entries short — a single paragraph is fine; the value is recording *that* a
decision was made and *why*, not filling out every field. (Gate adapted from Matt Pocock's
`domain-modeling` skill, MIT; see `founder-knowledge-base/02-playbooks/grilling-adapted.md`.)

---

## ADR-000 — <short title>

- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Superseded by ADR-NNN
- **Context:** <the forces at play; what made this a decision>
- **Options considered:**
  1. <option> — pros / cons
  2. <option> — pros / cons
- **Decision:** <what we chose>
- **Consequences:** <what becomes easier, what becomes harder, what we now owe>
