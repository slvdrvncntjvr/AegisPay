# Data model / schema

**Status:** implementation contract; versioned SQL migrations implemented and checked against PostgreSQL 17.11. Schema uses PostgreSQL snake_case. Product lifetimes and limits belong to [PRD business rules](prd.md); this document owns storage constraints.

## Entities & relationships (ERD)

```text
owner --< session
owner -- agent --< agent_run --< quote -- payment_attempt -- payment_evidence
                          |       |                            |
                          |       +----------------------- entitlement
                          +--< run_event
merchant --< resource --< quote
merchant --< merchant_claim
agent --< wallet_operation
job --> run / attempt / wallet_operation / claim
audit_event --> typed entity reference
```

## Schema / field definitions

All primary IDs are application-generated UUIDs. All timestamps are `timestamptz` in UTC; `created_at` defaults to DB `now()`. Explicit `?` below means nullable; other fields are NOT NULL with no implicit default. Amounts use unscaled PostgreSQL `numeric` with explicit integer and range checks `0 <= value <= 2^127-1`; quote/payment amounts must be positive. TypeScript parses amounts as `bigint`, never `number`; DB driver returns strings. Nonce uses `numeric(20,0)` bounded to unsigned 64-bit, JSON decimal strings. Hashes are normalized lowercase hex of validated length. Status fields have SQL CHECK constraints matching the declared values, not arbitrary strings.

| Entity | Fields / types and defaults | Purpose |
|--------|-----------------------------|---------|
| `owner` | `id uuid PK`, `wallet_address text UNIQUE`, `created_at` | One configured owner; address validated as account |
| `session` | `id uuid PK`, `token_hash char(64) UNIQUE`, `role text` (`owner/merchant/worker`), `owner_id uuid FK?`, `merchant_id uuid FK?`, `run_id uuid FK?`, `expires_at`, `revoked_at?`, `created_at` | One owner scope or one merchant scope; worker role has owner and run scope. CHECK enforces role/scope combination |
| `agent` | `id`, `owner_id FK`, `public_key text UNIQUE`, `device_hash char(64) UNIQUE`, `network text CHECK testnet`, `device_contract_id text`, `agent_contract_id text`, `escrow_contract_id text`, `asset_contract_id text`, `policy_max_stroops numeric`, `policy_expires_at`, `policy_observed_ledger bigint?`, `status text` (`unprovisioned/active/revoked/disabled`), `last_nonce numeric(20,0) default 0`, `lease_owner text?`, `lease_until?`, `created_at` | Confirmed policy cache with observed ledger, never sole authority for payment |
| `merchant` | `id`, `name text`, `wallet_address text UNIQUE`, `allowlisted boolean default true`, `created_at` | One configured merchant wallet |
| `resource` | `id`, `merchant_id FK`, `resource_key text UNIQUE`, `route_slug text UNIQUE`, `description text`, `price_stroops numeric`, `asset_contract_id text`, `fixture_version text`, `is_demo boolean CHECK true`, `enabled boolean default true`, `updated_at`, `created_at` | Public offer metadata; report body is a server-only fixture file |
| `agent_run` | `id`, `owner_id FK`, `agent_id FK`, `run_start_key text`, `status text` (`queued/running/waiting_payment/completed/failed`), `task_text text`, `budget_stroops numeric`, `reserved_stroops numeric default 0`, `spent_stroops numeric default 0`, `model_id text`, `model_turns integer default 0`, `tool_steps integer default 0`, `tool_checkpoint jsonb?`, `final_answer text?`, `error_code text?`, `started_at?`, `finished_at?`, `created_at` | Durable bounded execution and budget; UNIQUE owner/run-start key |
| `quote` | `id`, `resource_id FK`, `owner_id FK`, `agent_id FK`, `run_id FK`, `merchant_id FK`, `resource_key text`, `fixture_version text`, `merchant_address text`, `amount_stroops numeric`, `asset_contract_id text`, `network text`, `device_hash char(64)`, `agent_public_key text`, `terms_hash char(64)`, `expires_at`, `accepted_at?`, `status text` (`open/accepted/paid/expired/refused`), `created_at` | Snapshot of complete accepted terms independent of later price edits |
| `payment_attempt` | `id`, `owner_id FK`, `agent_id FK`, `quote_id FK UNIQUE`, `operation_id uuid UNIQUE`, `client_idempotency_key text`, `idempotency_key text UNIQUE`, `nonce numeric(20,0)`, `status text`, `signed_xdr_fingerprint char(64)?`, `signed_xdr_ciphertext bytea?`, `cipher_iv bytea?`, `cipher_tag bytea?`, `encryption_key_version text?`, `velo_request_id text UNIQUE?`, `inner_hash char(64) UNIQUE?`, `outer_hash char(64) UNIQUE?`, `velo_status text?`, `handoff_committed_at?`, `next_check_at?`, `error_code text?`, `created_at`, `updated_at` | Exact state values in system design; ciphertext only before handoff; amount/device read from immutable quote; client key is distinct from provider operation key |
| `payment_evidence` | `id`, `attempt_id FK UNIQUE`, `inner_hash char(64) UNIQUE`, `outer_hash char(64) UNIQUE?`, `observed_event_tx_hash char(64)`, `noir_event_id text UNIQUE`, `network text`, `contract_id text`, `ledger_sequence bigint`, `ledger_closed_at`, `agent_public_key text`, `device_hash char(64)`, `merchant_address text`, `asset_contract_id text`, `amount_stroops numeric`, `nonce numeric(20,0)`, `actual_fee_stroops numeric?`, `evidence_digest char(64)`, `verified_at` | Immutable decoded proof; not a browser-submitted assertion |
| `entitlement` | `id`, `quote_id FK UNIQUE`, `evidence_id FK UNIQUE`, `owner_id FK`, `resource_key text`, `fixture_version text`, `receipt_token_hash char(64) UNIQUE`, `valid_until`, `first_delivered_at?`, `created_at` | Reusable same-purchase access for the defined window |
| `wallet_operation` | `id`, `actor_address text`, `role text` (`owner/merchant`), `agent_id FK?`, `operation_kind text`, `operation_payload jsonb`, `unsigned_body_hash char(64)`, `expires_at`, `handoff_committed_at?`, `tx_hash char(64) UNIQUE?`, `status text` (`prepared/submitting/unknown/confirmed/failed/expired`), `created_at`, `updated_at` | Owner setup/revoke/funding and merchant-claim preparation; no private key |
| `merchant_claim` | `id`, `merchant_id FK`, `asset_contract_id text`, `wallet_operation_id FK UNIQUE`, `tx_hash char(64) UNIQUE?`, `observed_claim_amount_stroops numeric?`, `status text` (`prepared/submitting/unknown/confirmed/failed`), `confirmed_at?`, `created_at` | Aggregate sweep, not one claim per entitlement |
| `job` | `id`, `kind text` (`run/reconcile/wallet_observe/claim_observe`), `entity_id uuid`, `status text` (`queued/leased/done`), `lease_owner text?`, `lease_until?`, `available_at default now()`, `attempt_count integer default 0`, `created_at` | DB queue; no raw secrets or envelope in job payload |
| `run_event` | `id bigserial PK`, `run_id FK`, `kind text`, `safe_payload jsonb`, `created_at` | Ordered redacted activity for polling; no hidden model reasoning |
| `audit_event` | `id bigserial PK`, `actor_kind text`, `actor_id text`, `entity_kind text`, `entity_id text`, `kind text`, `correlation_id text`, `safe_metadata jsonb`, `created_at` | Payment and security history from allowlisted fields |
| `auth_throttle` | `key_hash char(64) PK`, `window_start`, `attempts integer`, `expires_at` | Cross-process login/write rate limiting without raw IP storage |

### Null/default behavior

Transaction and ledger fields are null until observed; null is never converted to a fabricated zero/hash. Claimed amount is null until confirmed. A session has no owner identity merely because a wallet connects. Financial snapshots and evidence have no UPDATE path except an append-only correction record. Cosmetic offer updates touch `resource`, never an accepted `quote`.

## Constraints & indexes

- Unique partial index allows at most one `queued/running/waiting_payment` run per agent. Unique active attempt per agent is enforced with the `agent_id FK` on attempts plus a partial index for all nonterminal states. A `manual_review` attempt remains active until operator resolution.
- `CHECK (spent_stroops >= 0 AND reserved_stroops >= 0 AND spent_stroops + reserved_stroops <= budget_stroops)` on runs. Lock order is agent → run → quote → attempt. A duplicate accept reads the existing attempt and never reserves again.
- Quote `terms_hash` covers the complete immutable snapshot. A SQL trigger rejects UPDATE to snapshot columns once `accepted_at` is set. Status/timestamps may transition only through domain queries with expected-state predicates.
- Receipt, quote, event and transaction uniqueness are enforced in SQL. Entitlement creation verifies its evidence/attempt/quote ownership within the same locked transaction; unique FK alone does not establish semantic matches.
- `UNIQUE (agent_id, nonce)` on payment attempts; nonce increases under the agent row lock and is not recycled on failure. Nonce initialization for an externally used agent is unresolved until read or a fresh agent/device is provisioned. Default MVP uses a new agent/device, not a preexisting nonce history.
- `UNIQUE (owner_id, client_idempotency_key)` binds the caller's retry key to one quote, separately from provider `idempotency_key = aegispay:<operation_id>`. Compare owner/agent/quote relationships in the locked accept transaction before returning an existing attempt. Client keys are bounded opaque UUID strings, never credentials.
- `UNIQUE (kind, entity_id)` on jobs. Index jobs `(status, available_at)`; attempts `(status, next_check_at)`; events `(run_id, id)`; entitlements `(owner_id, valid_until)`; quotes `(run_id, created_at)`.
- A unique partial index prevents concurrent unresolved wallet operations for the same signing address, avoiding Stellar sequence races during repeated UI submissions.
- Foreign keys use RESTRICT for quotes, attempts, evidence and entitlements. No cascading deletion of financial proof. Separate `merchant_claim` rows cannot alter entitlement ownership.
- Require `handoff_committed_at IS NULL` before any handoff claim. Commit that marker before network dispatch. Leases never clear it. Encrypt envelope with AES-256-GCM, fresh IV, operation ID as authenticated context, key kept outside DB; wipe ciphertext on handoff or definitive pre-handoff terminal state.

## Retention & privacy classification

Wallet addresses/tx hashes are public-chain data, but linked task text and actor IDs are internal. Session/receipt hashes are sensitive credentials metadata; raw tokens exist only in transit/process memory. API keys, wallet secrets and encryption keys are secret environment values and never DB columns. Ciphertext is sensitive and ephemeral. Fixture reports are protected demo content.

**[assumption] Demo retention:** expire sessions and remove expired throttle rows daily; remove run task text/tool checkpoints after 7 days; retain redacted transaction/audit evidence for 30 days or until the demo DB is torn down. Apply these policies through a small maintenance script, not a new service. Chain history itself cannot be deleted. No production privacy/compliance claim is made.

## Migration notes

Generate versioned Drizzle SQL, inspect constraints/triggers, migrate a fresh PostgreSQL instance and seed idempotently. Do not use schema `push` against a running demo with purchases. Keep resource fixture versions immutable for existing entitlements. Additive changes first; backfill verified values before NOT NULL enforcement. For failed migration, restore a DB snapshot or roll forward with a reviewed repair; never reset a funded ledger/DB pairing to hide a payment.

## Internal nonfinancial rehearsal authority — 2026-11-14

Trusted internal createRun callers may select budget_stroops0 for diagnostic runs; the public task-only API continues to use1000000. All quote amounts remain strictly positive. Existing atomic budget reservation therefore denies every purchase from zero-budget runs, including ordinary competing consumers and restarts. Migration0004 changes the run budget lower bound to0 and forbids budget increases; reducing a budget remains subject to spent-plus-reserved constraints. It does not change existing rows or release any hold. Diagnostic success is not a funded semantic no-purchase release gate.
