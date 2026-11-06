# Security & Compliance / Threat Model

> **Purpose:** risk and obligations. **Default to flagging missing auth on any exposed surface.**
> Traces back to: system design, data model, SRS.

## Data classification
<!-- Categories (public/internal/PII/secret) and where each lives. Pull from data model. -->

## Authn / authz model
<!-- How identity is established and how access is granted per resource/operation. -->

## Threat model
<!-- STRIDE-style pass: Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation.
     Each threat gets a stable ID (T-###) so mitigations and the pre-demo checklist can reference
     it. The `Enforces` column links a threat to the invariant/business rule it protects
     (INV-###/BR-###) — a hard product rule (INV-###) that has no threat enforcing it is a gap the
     consistency-checker should flag. -->

| T-ID | Threat (STRIDE) | Vector | Impact | Mitigation | Enforces |
|------|-----------------|--------|--------|------------|----------|
| T-001 |                |        |        |            | INV-### / BR-### |

## Abuse & safety-specific risks (ethical)
<!-- First-class for any product whose failure modes could harm the people it claims to serve
     (safety, health, finance, vulnerable users). Distinct from STRIDE: not "who attacks the
     system" but "how the system, working as built, could hurt a user or a third party." Tie each
     back to the invariant (INV-###) that guards against it. Mark N/A — because… if genuinely
     not applicable. -->
| Risk | Who is harmed | Trigger | Guard (INV-### / mitigation) |
|------|---------------|---------|------------------------------|

## Compliance obligations
<!-- Regulations/standards that apply and how the system satisfies them. -->

## Secrets handling
<!-- Where secrets live, rotation, who can access. Never inline a secret value anywhere. -->

## Audit & logging
<!-- What's logged for security/audit, retention, and what must NOT be logged (e.g. secrets, PII). -->

## Incident response basics
<!-- Detection, escalation path, rollback, who to notify. -->

## Pre-milestone hard-gate checklist
<!-- Hard pass/fail gates that MUST be true before any external milestone (public demo, pitch,
     handoff, deploy). Unlike the threat table (analysis), this is a go/no-go list. Each item is a
     checkbox with a date. A failed gate blocks the milestone — that is the point. -->
- [ ] Every network-exposed surface declares auth/authz (no open write paths). — {date}
- [ ] No secret is committed; all secrets referenced, not inlined. — {date}
- [ ] Every `INV-###` invariant still holds — no shipped feature/dataset/copy breaches a hard rule. — {date}
- [ ] The decision ledger and `docs/index.md §0` agree across live branches (reconcile pass run). — {date}
- [ ] {product-specific gate, e.g. deny-write rule verified against emulator before deploy} — {date}
