import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, char, timestamp, numeric, bigint, bigserial, integer, boolean, jsonb, customType, check, unique, uniqueIndex, index, foreignKey } from 'drizzle-orm/pg-core';

// Unscaled numeric plus integer/range CHECKs preserves the entire i128/uint64
// ranges and rejects fractional SQL writes instead of silently rounding them.
const amount = (name: string) => numeric(name);
const nonce = (name: string) => numeric(name);
const time = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const created = () => time('created_at').notNull().defaultNow();
const bytes = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });
const money = (name: string, column: string, positive = false) => {
  // Only static SQL identifiers reach this helper; values are bound by Drizzle.
  return check(name, sql.raw(`${column} = trunc(${column}) AND ${column} ${positive ? '>' : '>='} 0 AND ${column} <= 170141183460469231731687303715884105727`));
};
// Use explicit names for SQL checks to keep generated migrations reviewable.
const uint64 = (name: string, column: string, positive = false) => check(name, sql.raw(`${column} = trunc(${column}) AND ${column} ${positive ? '>' : '>='} 0 AND ${column} <= 18446744073709551615`));
const states = (name: string, column: string, values: readonly string[]) => check(name, sql.raw(`${column} IN (${values.map(v => `'${v}'`).join(',')})`));
const hex = (name: string, column: string) => check(name, sql.raw(`${column} ~ '^[a-f0-9]{64}$'`));
const account = (name: string, column: string) => check(name, sql.raw(`${column} ~ '^G[A-Z2-7]{55}$'`));
const contract = (name: string, column: string) => check(name, sql.raw(`${column} ~ '^C[A-Z2-7]{55}$'`));

export const owner = pgTable('owner', {
  id: uuid('id').primaryKey(), walletAddress: text('wallet_address').notNull().unique(), createdAt: created(),
}, () => [account('owner_wallet', 'wallet_address')]);

export const merchant = pgTable('merchant', {
  id: uuid('id').primaryKey(), name: text('name').notNull(), walletAddress: text('wallet_address').notNull().unique(),
  allowlisted: boolean('allowlisted').notNull().default(true), createdAt: created(),
}, () => [account('merchant_wallet', 'wallet_address')]);

export const agent = pgTable('agent', {
  id: uuid('id').primaryKey(), ownerId: uuid('owner_id').notNull().references(() => owner.id, { onDelete: 'restrict' }),
  publicKey: text('public_key').notNull().unique(), deviceHash: char('device_hash', { length: 64 }).notNull().unique(),
  network: text('network').notNull(), deviceContractId: text('device_contract_id').notNull(), agentContractId: text('agent_contract_id').notNull(),
  escrowContractId: text('escrow_contract_id').notNull(), assetContractId: text('asset_contract_id').notNull(),
  policyMaxStroops: amount('policy_max_stroops').notNull(), policyExpiresAt: time('policy_expires_at').notNull(),
  policyObservedLedger: bigint('policy_observed_ledger', { mode: 'bigint' }), status: text('status').notNull(),
  lastNonce: nonce('last_nonce').notNull().default('0'), leaseOwner: text('lease_owner'), leaseUntil: time('lease_until'), createdAt: created(),
}, t => [unique('agent_owner_identity').on(t.id, t.ownerId), hex('agent_device_hash', 'device_hash'), account('agent_key', 'public_key'),
  check('agent_testnet', sql`network = 'testnet'`), states('agent_status', 'status', ['unprovisioned', 'active', 'revoked', 'disabled']),
  money('agent_policy_amount', 'policy_max_stroops'), uint64('agent_nonce', 'last_nonce'),
  check('agent_ledger', sql`policy_observed_ledger IS NULL OR policy_observed_ledger > 0`),
  check('agent_active_policy', sql`status <> 'active' OR (policy_max_stroops > 0 AND policy_observed_ledger IS NOT NULL)`),
  check('agent_lease', sql`(lease_owner IS NULL) = (lease_until IS NULL)`),
  ...['device', 'agent', 'escrow', 'asset'].map(k => contract(`agent_${k}_contract`, `${k}_contract_id`)),
]);

export const resource = pgTable('resource', {
  id: uuid('id').primaryKey(), merchantId: uuid('merchant_id').notNull().references(() => merchant.id, { onDelete: 'restrict' }),
  resourceKey: text('resource_key').notNull().unique(), routeSlug: text('route_slug').notNull().unique(), description: text('description').notNull(),
  priceStroops: amount('price_stroops').notNull(), assetContractId: text('asset_contract_id').notNull(), fixtureVersion: text('fixture_version').notNull(),
  isDemo: boolean('is_demo').notNull(), enabled: boolean('enabled').notNull().default(true), updatedAt: time('updated_at').notNull().defaultNow(), createdAt: created(),
}, t => [unique('resource_merchant_identity').on(t.id, t.merchantId), money('resource_price', 'price_stroops', true),
  check('resource_demo', sql`is_demo = true`), contract('resource_asset', 'asset_contract_id')]);

export const agentRun = pgTable('agent_run', {
  id: uuid('id').primaryKey(), ownerId: uuid('owner_id').notNull().references(() => owner.id, { onDelete: 'restrict' }),
  agentId: uuid('agent_id').notNull(), runStartKey: uuid('run_start_key').notNull(), status: text('status').notNull(), taskText: text('task_text').notNull(),
  budgetStroops: amount('budget_stroops').notNull(), reservedStroops: amount('reserved_stroops').notNull().default('0'), spentStroops: amount('spent_stroops').notNull().default('0'),
  modelId: text('model_id').notNull(), modelTurns: integer('model_turns').notNull().default(0), toolSteps: integer('tool_steps').notNull().default(0),
  toolCheckpoint: jsonb('tool_checkpoint').$type<Record<string, unknown>>(), finalAnswer: text('final_answer'), errorCode: text('error_code'),
  startedAt: time('started_at'), finishedAt: time('finished_at'), createdAt: created(),
}, t => [foreignKey({ columns: [t.agentId, t.ownerId], foreignColumns: [agent.id, agent.ownerId] }).onDelete('restrict'),
  unique('run_owner_key').on(t.ownerId, t.runStartKey), unique('run_full_identity').on(t.id, t.agentId, t.ownerId),
  uniqueIndex('one_active_run_per_agent').on(t.agentId).where(sql`status IN ('queued','running','waiting_payment')`),
  states('run_status', 'status', ['queued', 'running', 'waiting_payment', 'completed', 'failed']),
  money('run_budget', 'budget_stroops', true), money('run_reserved', 'reserved_stroops'), money('run_spent', 'spent_stroops'),
  check('run_budget_limit', sql`spent_stroops + reserved_stroops <= budget_stroops AND budget_stroops <= 1000000`),
  check('run_bounds', sql`model_turns BETWEEN 0 AND 8 AND tool_steps BETWEEN 0 AND 12 AND length(task_text) BETWEEN 1 AND 2000`),
]);

export const session = pgTable('session', {
  id: uuid('id').primaryKey(), tokenHash: char('token_hash', { length: 64 }).notNull().unique(), role: text('role').notNull(),
  ownerId: uuid('owner_id').references(() => owner.id, { onDelete: 'restrict' }), merchantId: uuid('merchant_id').references(() => merchant.id, { onDelete: 'restrict' }),
  runId: uuid('run_id').references(() => agentRun.id, { onDelete: 'restrict' }), expiresAt: time('expires_at').notNull(), revokedAt: time('revoked_at'), createdAt: created(),
}, () => [hex('session_hash', 'token_hash'), check('session_scope', sql`(role = 'owner' AND owner_id IS NOT NULL AND merchant_id IS NULL AND run_id IS NULL) OR (role = 'merchant' AND merchant_id IS NOT NULL AND owner_id IS NULL AND run_id IS NULL) OR (role = 'worker' AND owner_id IS NOT NULL AND run_id IS NOT NULL AND merchant_id IS NULL)`),
  check('session_lifetime', sql`expires_at > created_at AND expires_at <= created_at + CASE WHEN role = 'worker' THEN interval '15 minutes' ELSE interval '8 hours' END`)]);

export const quote = pgTable('quote', {
  id: uuid('id').primaryKey(), resourceId: uuid('resource_id').notNull(), ownerId: uuid('owner_id').notNull(), agentId: uuid('agent_id').notNull(),
  runId: uuid('run_id').notNull(), merchantId: uuid('merchant_id').notNull(), resourceKey: text('resource_key').notNull(), fixtureVersion: text('fixture_version').notNull(),
  merchantAddress: text('merchant_address').notNull(), amountStroops: amount('amount_stroops').notNull(), assetContractId: text('asset_contract_id').notNull(),
  network: text('network').notNull(), deviceHash: char('device_hash', { length: 64 }).notNull(), agentPublicKey: text('agent_public_key').notNull(),
  termsHash: char('terms_hash', { length: 64 }).notNull(), expiresAt: time('expires_at').notNull(), acceptedAt: time('accepted_at'), status: text('status').notNull(), createdAt: created(),
}, t => [foreignKey({ columns: [t.runId, t.agentId, t.ownerId], foreignColumns: [agentRun.id, agentRun.agentId, agentRun.ownerId] }).onDelete('restrict'),
  foreignKey({ columns: [t.resourceId, t.merchantId], foreignColumns: [resource.id, resource.merchantId] }).onDelete('restrict'),
  unique('quote_owner_agent').on(t.id, t.ownerId, t.agentId), index('quote_run_created').on(t.runId, t.createdAt),
  money('quote_amount', 'amount_stroops', true), check('quote_network', sql`network = 'testnet'`), states('quote_status', 'status', ['open', 'accepted', 'paid', 'expired', 'refused']),
  hex('quote_terms', 'terms_hash'), hex('quote_device', 'device_hash'), account('quote_agent', 'agent_public_key'), account('quote_merchant', 'merchant_address'), contract('quote_asset', 'asset_contract_id'),
  check('quote_lifetime', sql`expires_at > created_at AND expires_at <= created_at + interval '120 seconds'`),
  check('quote_acceptance', sql`(status IN ('open','expired','refused') OR accepted_at IS NOT NULL) AND (accepted_at IS NULL OR accepted_at < expires_at)`),
]);

export const paymentAttempt = pgTable('payment_attempt', {
  id: uuid('id').primaryKey(), ownerId: uuid('owner_id').notNull(), agentId: uuid('agent_id').notNull(), quoteId: uuid('quote_id').notNull().unique(),
  operationId: uuid('operation_id').notNull().unique(), clientIdempotencyKey: uuid('client_idempotency_key').notNull(), idempotencyKey: text('idempotency_key').notNull().unique(),
  nonce: nonce('nonce').notNull(), status: text('status').notNull(), signedXdrFingerprint: char('signed_xdr_fingerprint', { length: 64 }),
  signedXdrCiphertext: bytes('signed_xdr_ciphertext'), cipherIv: bytes('cipher_iv'), cipherTag: bytes('cipher_tag'), encryptionKeyVersion: text('encryption_key_version'),
  veloRequestId: text('velo_request_id').unique(), innerHash: char('inner_hash', { length: 64 }).unique(), outerHash: char('outer_hash', { length: 64 }).unique(), veloStatus: text('velo_status'),
  handoffCommittedAt: time('handoff_committed_at'), nextCheckAt: time('next_check_at'), errorCode: text('error_code'), createdAt: created(), updatedAt: time('updated_at').notNull().defaultNow(),
}, t => [foreignKey({ columns: [t.quoteId, t.ownerId, t.agentId], foreignColumns: [quote.id, quote.ownerId, quote.agentId] }).onDelete('restrict'),
  unique('attempt_owner_client_key').on(t.ownerId, t.clientIdempotencyKey), unique('attempt_agent_nonce').on(t.agentId, t.nonce),
  uniqueIndex('one_active_attempt_per_agent').on(t.agentId).where(sql`status NOT IN ('authorized','refused','expired','failed')`),
  index('attempt_reconcile').on(t.status, t.nextCheckAt), uint64('attempt_nonce', 'nonce', true),
  states('attempt_status', 'status', ['accepted','preparing','signed','sponsoring','reserved','submitting','submitted','authorized','unknown','refused','expired','failed','manual_review']),
  check('attempt_provider_key', sql`idempotency_key = 'aegispay:' || operation_id::text`),
  ...['signed_xdr_fingerprint', 'inner_hash', 'outer_hash'].map(k => hex(`attempt_${k}`, k)),
  check('attempt_cipher', sql`(signed_xdr_ciphertext IS NULL AND cipher_iv IS NULL AND cipher_tag IS NULL AND encryption_key_version IS NULL) OR (signed_xdr_ciphertext IS NOT NULL AND cipher_iv IS NOT NULL AND cipher_tag IS NOT NULL AND octet_length(cipher_iv) = 12 AND octet_length(cipher_tag) = 16 AND encryption_key_version IS NOT NULL AND signed_xdr_fingerprint IS NOT NULL)`),
  check('attempt_handoff', sql`handoff_committed_at IS NULL OR (velo_request_id IS NOT NULL AND inner_hash IS NOT NULL AND signed_xdr_ciphertext IS NULL)`),
]);

export const paymentEvidence = pgTable('payment_evidence', {
  id: uuid('id').primaryKey(), attemptId: uuid('attempt_id').notNull().unique().references(() => paymentAttempt.id, { onDelete: 'restrict' }),
  innerHash: char('inner_hash', { length: 64 }).notNull().unique(), outerHash: char('outer_hash', { length: 64 }).unique(), observedEventTxHash: char('observed_event_tx_hash', { length: 64 }).notNull(),
  noirEventId: text('noir_event_id').notNull().unique(), network: text('network').notNull(), contractId: text('contract_id').notNull(),
  ledgerSequence: bigint('ledger_sequence', { mode: 'bigint' }).notNull(), ledgerClosedAt: time('ledger_closed_at').notNull(), agentPublicKey: text('agent_public_key').notNull(),
  deviceHash: char('device_hash', { length: 64 }).notNull(), merchantAddress: text('merchant_address').notNull(), assetContractId: text('asset_contract_id').notNull(),
  amountStroops: amount('amount_stroops').notNull(), nonce: nonce('nonce').notNull(), actualFeeStroops: amount('actual_fee_stroops'),
  feeProvenance: text('fee_provenance').notNull().default('unavailable'), evidenceDigest: char('evidence_digest', { length: 64 }).notNull(), verifiedAt: time('verified_at').notNull(),
}, () => [money('evidence_amount', 'amount_stroops', true), money('evidence_fee', 'actual_fee_stroops'), uint64('evidence_nonce', 'nonce', true),
  check('evidence_network', sql`network = 'testnet'`), check('evidence_ledger', sql`ledger_sequence > 0`),
  check('evidence_hash_mapping', sql`observed_event_tx_hash = inner_hash OR (outer_hash IS NOT NULL AND observed_event_tx_hash = outer_hash)`),
  check('evidence_fee_source', sql`(actual_fee_stroops IS NULL AND fee_provenance = 'unavailable') OR (actual_fee_stroops IS NOT NULL AND fee_provenance IN ('outer_ledger','outer_ledger_and_velo'))`),
  ...['inner_hash','outer_hash','observed_event_tx_hash','device_hash','evidence_digest'].map(k => hex(`evidence_${k}`, k)),
  account('evidence_agent', 'agent_public_key'), account('evidence_merchant', 'merchant_address'), contract('evidence_contract', 'contract_id'), contract('evidence_asset', 'asset_contract_id'),
]);

export const entitlement = pgTable('entitlement', {
  id: uuid('id').primaryKey(), quoteId: uuid('quote_id').notNull().unique().references(() => quote.id, { onDelete: 'restrict' }),
  evidenceId: uuid('evidence_id').notNull().unique().references(() => paymentEvidence.id, { onDelete: 'restrict' }), ownerId: uuid('owner_id').notNull().references(() => owner.id, { onDelete: 'restrict' }),
  resourceKey: text('resource_key').notNull(), fixtureVersion: text('fixture_version').notNull(), receiptTokenHash: char('receipt_token_hash', { length: 64 }).notNull().unique(),
  validUntil: time('valid_until').notNull(), firstDeliveredAt: time('first_delivered_at'), createdAt: created(),
}, t => [hex('entitlement_token', 'receipt_token_hash'), index('entitlement_owner_window').on(t.ownerId, t.validUntil)]);

export const walletOperation = pgTable('wallet_operation', {
  id: uuid('id').primaryKey(), actorAddress: text('actor_address').notNull(), role: text('role').notNull(), agentId: uuid('agent_id').references(() => agent.id, { onDelete: 'restrict' }),
  operationKind: text('operation_kind').notNull(), operationPayload: jsonb('operation_payload').$type<Record<string, unknown>>().notNull(), unsignedBodyHash: char('unsigned_body_hash', { length: 64 }).notNull(),
  expiresAt: time('expires_at').notNull(), handoffCommittedAt: time('handoff_committed_at'), txHash: char('tx_hash', { length: 64 }).unique(), status: text('status').notNull(), createdAt: created(), updatedAt: time('updated_at').notNull().defaultNow(),
}, t => [account('wallet_actor', 'actor_address'), hex('wallet_body', 'unsigned_body_hash'), hex('wallet_tx', 'tx_hash'),
  states('wallet_status', 'status', ['prepared','submitting','unknown','confirmed','failed','expired']),
  check('wallet_role_kind', sql`(role = 'merchant' AND operation_kind = 'claim' AND agent_id IS NULL) OR (role = 'owner' AND agent_id IS NOT NULL AND operation_kind IN ('registerDevice','registerAgent','fundEscrow','defundEscrow','revokeAgent','sweepOnRevoke'))`),
  check('wallet_handoff', sql`handoff_committed_at IS NULL OR tx_hash IS NOT NULL`),
  uniqueIndex('one_unresolved_wallet_per_actor').on(t.actorAddress).where(sql`status IN ('prepared','submitting','unknown')`),
]);

export const merchantClaim = pgTable('merchant_claim', {
  id: uuid('id').primaryKey(), merchantId: uuid('merchant_id').notNull().references(() => merchant.id, { onDelete: 'restrict' }),
  assetContractId: text('asset_contract_id').notNull(), walletOperationId: uuid('wallet_operation_id').notNull().unique().references(() => walletOperation.id, { onDelete: 'restrict' }),
  txHash: char('tx_hash', { length: 64 }).unique(), observedClaimAmountStroops: amount('observed_claim_amount_stroops'), status: text('status').notNull(), confirmedAt: time('confirmed_at'), createdAt: created(),
}, () => [contract('claim_asset', 'asset_contract_id'), hex('claim_hash', 'tx_hash'), money('claim_amount', 'observed_claim_amount_stroops'), states('claim_status', 'status', ['prepared','submitting','unknown','confirmed','failed']),
  check('claim_confirmation', sql`status <> 'confirmed' OR (tx_hash IS NOT NULL AND confirmed_at IS NOT NULL AND observed_claim_amount_stroops IS NOT NULL)`)]);

export const job = pgTable('job', {
  id: uuid('id').primaryKey(), kind: text('kind').notNull(), entityId: uuid('entity_id').notNull(), status: text('status').notNull().default('queued'),
  leaseOwner: text('lease_owner'), leaseUntil: time('lease_until'), availableAt: time('available_at').notNull().defaultNow(), attemptCount: integer('attempt_count').notNull().default(0), createdAt: created(),
}, t => [unique('job_kind_entity').on(t.kind, t.entityId), index('job_available').on(t.status, t.availableAt), states('job_kind', 'kind', ['run','reconcile','wallet_observe','claim_observe']),
  states('job_status', 'status', ['queued','leased','done']), check('job_attempt_count', sql`attempt_count >= 0`),
  check('job_lease', sql`(status = 'leased' AND lease_owner IS NOT NULL AND lease_until IS NOT NULL) OR (status <> 'leased' AND lease_owner IS NULL AND lease_until IS NULL)`)]);

export const runEvent = pgTable('run_event', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(), runId: uuid('run_id').notNull().references(() => agentRun.id, { onDelete: 'restrict' }), kind: text('kind').notNull(),
  safePayload: jsonb('safe_payload').$type<Record<string, unknown>>().notNull(), createdAt: created(),
}, t => [index('run_event_order').on(t.runId, t.id)]);
export const auditEvent = pgTable('audit_event', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(), actorKind: text('actor_kind').notNull(), actorId: text('actor_id').notNull(), entityKind: text('entity_kind').notNull(), entityId: text('entity_id').notNull(),
  kind: text('kind').notNull(), correlationId: text('correlation_id').notNull(), safeMetadata: jsonb('safe_metadata').$type<Record<string, unknown>>().notNull(), createdAt: created(),
});

// A retried quote may arrive with another caller key. Keep every accepted alias
// bound to that original purchase so the alias cannot later target another quote.
export const paymentAcceptKey = pgTable('payment_accept_key', {
  id: uuid('id').primaryKey(), ownerId: uuid('owner_id').notNull().references(() => owner.id, { onDelete: 'restrict' }),
  clientKey: uuid('client_key').notNull(), quoteId: uuid('quote_id').notNull().references(() => quote.id, { onDelete: 'restrict' }),
  attemptId: uuid('attempt_id').notNull().references(() => paymentAttempt.id, { onDelete: 'restrict' }), createdAt: created(),
}, t => [unique('accept_key_owner_key').on(t.ownerId, t.clientKey)]);
export const authThrottle = pgTable('auth_throttle', {
  keyHash: char('key_hash', { length: 64 }).primaryKey(), windowStart: time('window_start').notNull(), attempts: integer('attempts').notNull(), expiresAt: time('expires_at').notNull(),
}, () => [hex('throttle_hash', 'key_hash'), check('throttle_bounds', sql`attempts >= 0 AND expires_at > window_start`)]);
