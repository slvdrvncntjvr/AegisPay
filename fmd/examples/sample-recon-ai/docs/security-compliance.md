# Security & Compliance — ReconLens (MVP)

> Worked example. Included because the system has a network-exposed surface (the web API) and
> handles sensitive financial data — the manifest condition for this doc.

## Data classification
- **Sensitive (financial):** `ImportedRow.amount`, `external_id`, raw uploaded CSVs. Encrypted
  at rest in DB + object storage. Never written to logs.
- **PII:** the ops user's auth identity (email). Handled by the auth provider.
- No bank/processor credentials stored (CSV import only — idea.md §9).

## Authn / authz model
- Every API endpoint requires an authenticated session (auth provider).
- Account-scoped: a user can only read/write rows, exceptions, and resolutions for their own
  account. Enforced server-side on every query, not just in the UI.
- No public/unauthenticated endpoints. Any future public endpoint must justify why it's safe.

## Threat model (STRIDE)

| Threat | Vector | Impact | Mitigation |
|--------|--------|--------|------------|
| Spoofing | Stolen session | Access to financial data | Short-lived sessions via auth provider; re-auth on sensitive actions |
| Tampering | Forged resolution | Broken audit trail | Append-only Resolution (BR-004); no UPDATE/DELETE permission |
| Repudiation | "I didn't resolve that" | Audit dispute | Every Resolution has created_at + actor; append-only |
| Info disclosure | Cross-account read | Leak of another firm's finances | Account-scoped authz on every query |
| DoS | Huge CSV upload | Service exhaustion | Upload size cap + row-count cap; reject oversized files |
| Elevation | User accesses another account | Data breach | Server-side account scoping; no client-trusted account id |

## Compliance obligations
Financial data handling implies audit-trail and retention expectations. The append-only
resolution log (BR-004) is the core control. Formal SOC2/PCI scoping is a final-product concern,
flagged here, not implemented in MVP. `[assumption — confirm with counsel before GA]`

## Secrets handling
Auth provider keys and storage credentials live in the platform secret store, referenced by
name. Never inlined in code, config, or logs.

## Audit & logging
Log auth events and resolution actions (who, when, which exception). **Never** log amounts,
external ids, or CSV contents.

## Incident response basics
Detection: alert on cross-account access errors and auth anomalies. Escalation: notify the
account owner. Rollback: resolutions are append-only, so recovery is forward-only (add a
correcting resolution, never delete).
