# Decision Ledger — {project_name}

> **What this is.** One append-only, trunk-only record of pivots, rejected approaches, naming
> decisions, significant choices, and the assumptions/evidence behind those choices. It preserves
> decision history so a human or agent does not re-derive it from chats. It does **not** override the
> PRD, system design, QA plan, or implementation plan. A disagreement is a failed checkpoint: stop
> and reconcile the decision into the concern's canonical owner before continuing.
>
> **What this is NOT.** It is **not** a product specification, freeze, or task tracker. Product
> behavior belongs to the PRD, architecture to system design, test intent to the QA plan, and routine
> `TASK-###` status/work evidence to `docs/implementation-plan.md`. Put an item here only when it
> records a decision/pivot, rejects an approach, changes a name/immutable ID, or captures an
> assumption that informed a decision. The ledger makes change coherent, not slow.
>
> **Maintained mechanically, not by memory.** The git hook in `hooks/` and the discipline in
> `AGENTS.md` keep this current at commit time — the previous generation of this artifact went stale
> because it relied on human diligence under deadline. Do not rely on remembering to update it.
>
> **How an agent uses this:** read §1 (names/immutable IDs), §2 (decision assumptions), and §3
> (pivots/decisions) before changing a recorded choice. Never state a §2 UNVALIDATED assumption as
> fact. Then read `docs/index.md §0` and the canonical product/architecture/test/execution doc for
> the concern being changed.
> **Last reconciled:** {date}

## 1. Names & immutable identifiers (read first)

Branding changes; technical identifiers must not. Record every name and, critically, which IDs are
**immutable** so no agent "fixes" them.

| Name / ID | Kind | Where it appears | Rule |
|-----------|------|------------------|------|
| {public_name} | public product name | UI, pitch, README, judge-facing | Use everywhere a user/judge sees. |
| {codename} | internal codename | code comments, doc provenance | Known alias; **not** a bug to fix blindly. |
| {technical_id} | **IMMUTABLE technical id** | infra/config (e.g. Firebase project id, DB name, bucket) | **Never rename** — renaming breaks deploys/config. |

> A rebrand (public name change) is a **pivot** (§3, type = `rebrand`): log it, then let the
> reconciler propagate the new public name everywhere **except** the IMMUTABLE rows above.

## 2. Decision assumptions & evidence (confidence, not a product spec)

These rows grade assumptions/evidence that informed a decision. They never redefine behavior,
architecture, tests, or task state; those stay in their canonical docs.

| SUPPORTED (decision context backed by events) | PROVISIONAL (accepted, not yet verified end-to-end) | UNVALIDATED (do not state as fact) |
|---|---|---|
| {fact} | {fact} | {assumption} |

## 3. Pivots & decisions (newest first, append at top)

Each entry: date · what changed · **pivot type** · from → to · why · **invalidated claims** (reset
to UNVALIDATED) · superseding ADR (if any). Pivot types (from the design of record):
`zoom-in | zoom-out | segment | need | platform | use-case | market | rebrand | invariant-change`.

### {YYYY-MM-DD} — {short title}
- **Type:** {pivot_type}
- **Change:** {from} → {to}
- **Why:** {the real reason / what reality diverged from the plan}
- **Invalidated:** {claims/IDs now reset to UNVALIDATED, if any}
- **Recorded as:** {ADR-####, if the decision was significant}

## 4. Rejected approaches (what we tried and killed — and why)

The highest-value section and the one most logs omit. Record what you *tried and dropped*, so the
next build (and the framework) learns from it. A rejected approach is not failure — it is evidence.

| Approach considered | Rejected because | Would revisit if |
|---------------------|------------------|------------------|
| {approach} | {the specific reason} | {what would change the decision} |

## 5. Invariant audit (the `INV-###` guardrails)

Every change that touches a hard product rule (`INV-###` from `idea.md §9` → the PRD must-never
rules) gets a line here **before merge** — the guardrail that has no audit trail is the one that
gets breached by accident under pressure.

| Date | INV-### | Change that touched it | Audit verdict |
|------|---------|------------------------|---------------|
| {date} | INV-001 | {dataset/feature/copy that could breach it} | {kept / blocked / mitigated — how} |

## 6. Open items / risks (do not lose these)

- {risk or open item — carried until resolved, then moved to §3 with a date}

## References
- `docs/index.md §0` — source-of-truth map (one fact, one home)
- `docs/adr/` — significant decisions (each pairs with a §3 line — enforced by the git hook)
- `hooks/` — the commit-time enforcement that keeps this ledger honest
