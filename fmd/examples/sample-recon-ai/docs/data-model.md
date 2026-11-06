# Data Model — ReconLens (MVP)

> Worked example.

## Entities & relationships (ERD)

```
Account 1───* Period 1───* ImportedRow
                 │              │
                 │              └──* (matched/unmatched)
                 └──* Match *── ImportedRow (ledger) + ImportedRow (processor)
                 └──* Exception 1───* Resolution   (append-only)
```

## Schema / field definitions

### Period
| Field | Type | Null? | Default | Description |
|-------|------|-------|---------|-------------|
| id | uuid | no | gen | PK |
| account_id | uuid | no | | FK → Account |
| label | text | no | | e.g. "2026-05" |
| status | text | no | 'open' | 'open' or 'reconciled' (BR-003) |

### ImportedRow
| Field | Type | Null? | Default | Description |
|-------|------|-------|---------|-------------|
| id | uuid | no | gen | PK |
| period_id | uuid | no | | FK → Period |
| source | text | no | | 'ledger' or 'processor' |
| amount | numeric(18,2) | no | | **Sensitive (financial)** |
| txn_date | date | no | | Transaction date |
| external_id | text | yes | | Source-side id (fuzzy-matched, BR-001) |

### Match
| Field | Type | Null? | Default | Description |
|-------|------|-------|---------|-------------|
| id | uuid | no | gen | PK |
| ledger_row_id | uuid | no | | FK → ImportedRow |
| processor_row_id | uuid | no | | FK → ImportedRow |

### Exception
| Field | Type | Null? | Default | Description |
|-------|------|-------|---------|-------------|
| id | uuid | no | gen | PK |
| period_id | uuid | no | | FK → Period |
| row_id | uuid | no | | FK → ImportedRow (the unmatched row) |
| reason | text | no | | One of BR-002 reasons |
| status | text | no | 'open' | 'open' or 'resolved' |

### Resolution (append-only — BR-004)
| Field | Type | Null? | Default | Description |
|-------|------|-------|---------|-------------|
| id | uuid | no | gen | PK |
| exception_id | uuid | no | | FK → Exception |
| action | text | no | | 'confirm-match' / 'categorize' / 'leave-open' |
| note | text | yes | | Optional judgment note |
| created_at | timestamptz | no | now() | Never updated |

## Constraints & indexes
- Unique `(ledger_row_id, processor_row_id)` on Match — no double-matching a row.
- Index `(period_id, status)` on Exception — fast open-queue query (F-003).
- No UPDATE/DELETE on Resolution (append-only, BR-004) — enforce via permissions.

## Retention & privacy classification
- `ImportedRow.amount`, `external_id`, raw CSVs — **Sensitive (financial)**. Encrypted at rest;
  not logged. Deleted with the account.
- No bank credentials stored (CSV import only — idea.md §9 constraint).

## Migration notes
Forward-only migrations. Append-only Resolution table created with its no-update permission from
the start; no backfill needed for MVP.
