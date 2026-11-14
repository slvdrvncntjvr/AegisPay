-- Prepared parameterized SELECT only, not live acceptance or a mutating script.
-- $1 = independent agent UUID, $2 = exactly two saved attempt UUIDs (uuid[]),
-- $3 = exact merchant claim UUID (nullable), $4 = exact wallet-operation UUIDs
-- (uuid[]), $5 = expected independent device hash. No arbitrary SQL interpolation.
-- Caller must BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
-- SET LOCAL statement_timeout = '5s'; execute with bound values; ROLLBACK.
WITH context AS (
  SELECT id, owner_id, public_key, device_hash, asset_contract_id
  FROM agent WHERE id = $1::uuid AND device_hash = $5
    AND id <> 'e901976a-7ef3-4784-b510-bc1632935d35'::uuid
    AND device_hash <> '790905edd7c6d36e300d0149ed6d73ef60db6bcc6635c50fa2b7312dc7bbeb7c'
    AND network = 'testnet'
), purchases AS (
  SELECT p.id AS attempt_id, p.operation_id, p.nonce::text, p.status,
    p.velo_request_id, p.inner_hash, p.outer_hash, p.handoff_committed_at,
    q.id AS quote_id, q.run_id, q.resource_key, q.amount_stroops::text,
    q.terms_hash, q.accepted_at, q.expires_at, q.merchant_id,
    e.id AS evidence_id, e.observed_event_tx_hash, e.noir_event_id,
    e.ledger_sequence::text, e.verified_at,
    g.id AS receipt_id, g.first_delivered_at, g.valid_until,
    COALESCE(g.owner_id = q.owner_id AND g.resource_key = q.resource_key
      AND g.fixture_version = q.fixture_version AND g.evidence_id = e.id, false) AS receipt_links_match
  FROM context c JOIN payment_attempt p ON p.agent_id = c.id
  JOIN quote q ON q.id = p.quote_id AND q.agent_id = c.id AND q.owner_id = c.owner_id
  LEFT JOIN payment_evidence e ON e.attempt_id = p.id
  LEFT JOIN entitlement g ON g.quote_id = q.id
  WHERE p.id = ANY($2::uuid[]) AND cardinality($2::uuid[]) = 2
    AND p.id <> 'f69178b7-0b0b-46fa-8e82-65c2dd5deee5'::uuid
), wallets AS (
  SELECT w.id, w.operation_kind, w.status, w.tx_hash, w.handoff_committed_at
  FROM context c JOIN wallet_operation w ON w.agent_id = c.id
  WHERE w.id = ANY($4::uuid[])
), claims AS (
  SELECT m.id, m.status, m.tx_hash, m.observed_claim_amount_stroops::text,
    m.confirmed_at, m.wallet_operation_id
  FROM merchant_claim m JOIN wallet_operation w ON w.id = m.wallet_operation_id
  WHERE m.id = $3::uuid AND m.merchant_id IN (SELECT merchant_id FROM purchases)
    AND m.asset_contract_id IN (SELECT asset_contract_id FROM context)
    AND w.operation_kind = 'claim' AND w.role = 'merchant'
)
SELECT jsonb_build_object(
  'classification', 'stored-application-metadata-only-not-independent-live-acceptance',
  'observedAt', clock_timestamp(), 'financialActions', 0, 'fullRelease', false,
  'contextMatched', EXISTS(SELECT 1 FROM context),
  'twoDistinctAttemptRows', (SELECT count(*) = 2 FROM purchases),
  'purchases', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM purchases p), '[]'::jsonb),
  'wallets', COALESCE((SELECT jsonb_agg(to_jsonb(w)) FROM wallets w), '[]'::jsonb),
  'claims', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM claims m), '[]'::jsonb),
  'remaining', jsonb_build_array('independent-chain-observe', 'claim-lifecycle-refusal-proof',
    'actual-model-price-and-no-purchase-traces', 'authenticated-resource-delivery', 'hosted-security-recovery-media')
) AS metadata;
