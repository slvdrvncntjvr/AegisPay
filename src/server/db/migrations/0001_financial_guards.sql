-- Inspected application invariants supplementing the generated Drizzle schema.
-- No reset, schema push, extension, provider call or financial fixture is used.

CREATE FUNCTION deny_financial_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_FINANCIAL_RECORD'; END $$;
CREATE TRIGGER evidence_immutable BEFORE UPDATE OR DELETE ON payment_evidence FOR EACH ROW EXECUTE FUNCTION deny_financial_mutation();
CREATE TRIGGER attempt_no_delete BEFORE DELETE ON payment_attempt FOR EACH ROW EXECUTE FUNCTION deny_financial_mutation();
CREATE TRIGGER quote_no_delete BEFORE DELETE ON quote FOR EACH ROW EXECUTE FUNCTION deny_financial_mutation();

CREATE FUNCTION guard_quote() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a agent%ROWTYPE; r resource%ROWTYPE; m merchant%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - ARRAY['status','accepted_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','accepted_at'])
       OR (OLD.accepted_at IS NOT NULL AND NEW.accepted_at IS DISTINCT FROM OLD.accepted_at)
       OR (OLD.status = 'paid' AND NEW.status <> 'paid')
       OR (OLD.status IN ('expired','refused') AND NEW.status <> OLD.status)
       OR (OLD.status = 'accepted' AND NEW.status NOT IN ('accepted','paid','expired','refused'))
       OR (OLD.status = 'open' AND NEW.status NOT IN ('open','accepted','expired','refused')) THEN
      RAISE EXCEPTION 'IMMUTABLE_QUOTE';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO STRICT a FROM agent WHERE id = NEW.agent_id;
  SELECT * INTO STRICT r FROM resource WHERE id = NEW.resource_id;
  SELECT * INTO STRICT m FROM merchant WHERE id = NEW.merchant_id;
  IF NEW.owner_id <> a.owner_id OR NEW.agent_public_key <> a.public_key OR NEW.device_hash <> a.device_hash
    OR NEW.asset_contract_id <> a.asset_contract_id OR NEW.network <> a.network
    OR NEW.resource_key <> r.resource_key OR NEW.fixture_version <> r.fixture_version
    OR NEW.amount_stroops <> r.price_stroops OR NEW.asset_contract_id <> r.asset_contract_id
    OR NEW.merchant_id <> r.merchant_id OR NEW.merchant_address <> m.wallet_address
    OR NOT m.allowlisted OR NOT r.enabled OR NEW.status <> 'open' OR NEW.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'QUOTE_SNAPSHOT_MISMATCH';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quote_guard BEFORE INSERT OR UPDATE ON quote FOR EACH ROW EXECUTE FUNCTION guard_quote();

CREATE FUNCTION guard_agent_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.last_nonce < OLD.last_nonce OR
    ROW(NEW.id, NEW.owner_id, NEW.public_key, NEW.device_hash, NEW.network, NEW.device_contract_id, NEW.agent_contract_id, NEW.escrow_contract_id, NEW.asset_contract_id)
    IS DISTINCT FROM ROW(OLD.id, OLD.owner_id, OLD.public_key, OLD.device_hash, OLD.network, OLD.device_contract_id, OLD.agent_contract_id, OLD.escrow_contract_id, OLD.asset_contract_id) THEN
    RAISE EXCEPTION 'AGENT_IDENTITY_OR_NONCE_MUTATION';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER agent_identity_guard BEFORE UPDATE ON agent FOR EACH ROW EXECUTE FUNCTION guard_agent_identity();

CREATE FUNCTION guard_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q quote%ROWTYPE; a agent%ROWTYPE; r agent_run%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO STRICT q FROM quote WHERE id = NEW.quote_id;
    SELECT * INTO STRICT a FROM agent WHERE id = NEW.agent_id;
    SELECT * INTO STRICT r FROM agent_run WHERE id = q.run_id;
    IF q.status <> 'accepted' OR q.accepted_at IS NULL OR q.expires_at <= clock_timestamp()
       OR a.status <> 'active' OR a.policy_observed_ledger IS NULL OR a.policy_expires_at <= clock_timestamp()
       OR a.policy_max_stroops < q.amount_stroops OR a.last_nonce <> NEW.nonce
       OR r.reserved_stroops < q.amount_stroops OR NEW.status <> 'accepted' OR NEW.handoff_committed_at IS NOT NULL THEN
      RAISE EXCEPTION 'ATTEMPT_NOT_RESERVED_OR_READY';
    END IF;
  ELSE
    IF ROW(NEW.id,NEW.owner_id,NEW.agent_id,NEW.quote_id,NEW.operation_id,NEW.client_idempotency_key,NEW.idempotency_key,NEW.nonce,NEW.created_at)
       IS DISTINCT FROM ROW(OLD.id,OLD.owner_id,OLD.agent_id,OLD.quote_id,OLD.operation_id,OLD.client_idempotency_key,OLD.idempotency_key,OLD.nonce,OLD.created_at)
       OR (OLD.status IN ('authorized','refused','expired','failed') AND NEW.status <> OLD.status)
       OR (OLD.handoff_committed_at IS NOT NULL AND NEW.handoff_committed_at IS DISTINCT FROM OLD.handoff_committed_at)
       OR (OLD.velo_request_id IS NOT NULL AND NEW.velo_request_id IS DISTINCT FROM OLD.velo_request_id)
       OR (OLD.inner_hash IS NOT NULL AND NEW.inner_hash IS DISTINCT FROM OLD.inner_hash)
       OR (OLD.outer_hash IS NOT NULL AND NEW.outer_hash IS DISTINCT FROM OLD.outer_hash)
       OR (OLD.signed_xdr_fingerprint IS NOT NULL AND NEW.signed_xdr_fingerprint IS DISTINCT FROM OLD.signed_xdr_fingerprint) THEN
      RAISE EXCEPTION 'IMMUTABLE_ATTEMPT_IDENTITY_OR_TERMINAL_STATE';
    END IF;
    IF NEW.status <> OLD.status AND NOT (
      (OLD.status = 'accepted' AND NEW.status IN ('preparing','refused','expired','unknown','manual_review')) OR
      (OLD.status = 'preparing' AND NEW.status IN ('signed','refused','expired','unknown','manual_review')) OR
      (OLD.status = 'signed' AND NEW.status IN ('sponsoring','refused','expired','unknown','manual_review')) OR
      (OLD.status = 'sponsoring' AND NEW.status IN ('reserved','refused','expired','unknown','manual_review')) OR
      (OLD.status = 'reserved' AND NEW.status IN ('submitting','refused','expired','unknown','manual_review')) OR
      (OLD.status = 'submitting' AND NEW.status IN ('submitted','authorized','unknown','failed','manual_review')) OR
      (OLD.status = 'submitted' AND NEW.status IN ('authorized','unknown','failed','manual_review')) OR
      (OLD.status = 'unknown' AND NEW.status IN ('authorized','failed','manual_review')) OR
      (OLD.status = 'manual_review' AND NEW.status IN ('authorized','failed'))
    ) THEN RAISE EXCEPTION 'INVALID_ATTEMPT_TRANSITION'; END IF;
    IF OLD.handoff_committed_at IS NULL AND NEW.handoff_committed_at IS NOT NULL THEN
      SELECT * INTO STRICT q FROM quote WHERE id = NEW.quote_id;
      IF NEW.handoff_committed_at >= q.expires_at OR NEW.handoff_committed_at < q.accepted_at OR NEW.status <> 'submitting' THEN
        RAISE EXCEPTION 'HANDOFF_NOT_TIMELY';
      END IF;
    END IF;
    IF NEW.handoff_committed_at IS NOT NULL AND NEW.status IN ('accepted','preparing','signed','sponsoring','reserved','refused','expired') THEN
      RAISE EXCEPTION 'HANDOFF_CANNOT_RETURN_TO_PREPARATION';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attempt_guard BEFORE INSERT OR UPDATE ON payment_attempt FOR EACH ROW EXECUTE FUNCTION guard_attempt();

CREATE FUNCTION guard_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p payment_attempt%ROWTYPE; q quote%ROWTYPE; a agent%ROWTYPE;
BEGIN
  SELECT * INTO STRICT p FROM payment_attempt WHERE id = NEW.attempt_id;
  SELECT * INTO STRICT q FROM quote WHERE id = p.quote_id;
  SELECT * INTO STRICT a FROM agent WHERE id = p.agent_id;
  IF p.status NOT IN ('submitting','submitted','unknown','manual_review') OR p.velo_status IS DISTINCT FROM 'succeeded'
    OR p.handoff_committed_at IS NULL OR p.handoff_committed_at >= q.expires_at OR p.handoff_committed_at < q.accepted_at
    OR NEW.inner_hash IS DISTINCT FROM p.inner_hash OR NEW.outer_hash IS DISTINCT FROM p.outer_hash
    OR NEW.network <> q.network OR NEW.contract_id <> a.escrow_contract_id
    OR NEW.agent_public_key <> q.agent_public_key OR NEW.device_hash <> q.device_hash OR NEW.merchant_address <> q.merchant_address
    OR NEW.asset_contract_id <> q.asset_contract_id OR NEW.amount_stroops <> q.amount_stroops OR NEW.nonce <> p.nonce
    OR NEW.ledger_closed_at < p.handoff_committed_at OR NEW.verified_at < NEW.ledger_closed_at THEN
    RAISE EXCEPTION 'EVIDENCE_CONTEXT_MISMATCH';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER evidence_guard BEFORE INSERT ON payment_evidence FOR EACH ROW EXECUTE FUNCTION guard_evidence();

CREATE FUNCTION guard_entitlement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e payment_evidence%ROWTYPE; p payment_attempt%ROWTYPE; q quote%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - 'first_delivered_at') IS DISTINCT FROM (to_jsonb(OLD) - 'first_delivered_at')
      OR (OLD.first_delivered_at IS NOT NULL AND NEW.first_delivered_at IS DISTINCT FROM OLD.first_delivered_at) THEN
      RAISE EXCEPTION 'IMMUTABLE_ENTITLEMENT';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO STRICT e FROM payment_evidence WHERE id = NEW.evidence_id;
  SELECT * INTO STRICT p FROM payment_attempt WHERE id = e.attempt_id;
  SELECT * INTO STRICT q FROM quote WHERE id = p.quote_id;
  IF NEW.quote_id <> q.id OR NEW.owner_id <> q.owner_id OR p.owner_id <> q.owner_id OR p.agent_id <> q.agent_id
    OR NEW.resource_key <> q.resource_key OR NEW.fixture_version <> q.fixture_version
    OR NEW.valid_until <> e.verified_at + interval '15 minutes' THEN
    RAISE EXCEPTION 'ENTITLEMENT_CONTEXT_MISMATCH';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER entitlement_guard BEFORE INSERT OR UPDATE ON entitlement FOR EACH ROW EXECUTE FUNCTION guard_entitlement();
CREATE TRIGGER entitlement_no_delete BEFORE DELETE ON entitlement FOR EACH ROW EXECUTE FUNCTION deny_financial_mutation();

-- Deferred checks permit the domain to commit all accounting/proof changes atomically,
-- but reject direct SQL that marks paid, drops held budget, or omits fulfillment.
CREATE FUNCTION check_run_accounting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rid uuid; r agent_run%ROWTYPE; reserved numeric; spent numeric;
BEGIN
  IF TG_TABLE_NAME = 'agent_run' THEN rid := NEW.id;
  ELSE SELECT run_id INTO STRICT rid FROM quote WHERE id = NEW.quote_id; END IF;
  SELECT * INTO STRICT r FROM agent_run WHERE id = rid;
  SELECT COALESCE(sum(q.amount_stroops) FILTER (WHERE p.status NOT IN ('authorized','refused','expired','failed')),0),
         COALESCE(sum(q.amount_stroops) FILTER (WHERE p.status = 'authorized'),0)
    INTO reserved, spent FROM quote q JOIN payment_attempt p ON p.quote_id = q.id WHERE q.run_id = rid;
  IF r.reserved_stroops <> reserved OR r.spent_stroops <> spent THEN RAISE EXCEPTION 'RUN_ACCOUNTING_MISMATCH'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER run_accounting AFTER INSERT OR UPDATE ON agent_run DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_run_accounting();
CREATE CONSTRAINT TRIGGER attempt_accounting AFTER INSERT OR UPDATE ON payment_attempt DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_run_accounting();

CREATE FUNCTION check_authorization_bundle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pid uuid; p payment_attempt%ROWTYPE; q quote%ROWTYPE; evidence_count int; grant_count int;
BEGIN
  IF TG_TABLE_NAME = 'payment_attempt' THEN pid := NEW.id;
  ELSIF TG_TABLE_NAME = 'payment_evidence' THEN pid := NEW.attempt_id;
  ELSE SELECT id INTO STRICT pid FROM payment_attempt WHERE quote_id = NEW.id; END IF;
  SELECT * INTO STRICT p FROM payment_attempt WHERE id = pid;
  SELECT * INTO STRICT q FROM quote WHERE id = p.quote_id;
  SELECT count(*) INTO evidence_count FROM payment_evidence WHERE attempt_id = pid;
  SELECT count(*) INTO grant_count FROM entitlement WHERE quote_id = q.id;
  IF (p.status = 'authorized' AND (evidence_count <> 1 OR grant_count <> 1 OR q.status <> 'paid'))
    OR (p.status <> 'authorized' AND (evidence_count <> 0 OR grant_count <> 0 OR q.status = 'paid')) THEN
    RAISE EXCEPTION 'INCOMPLETE_AUTHORIZATION_BUNDLE';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER attempt_authorization_bundle AFTER INSERT OR UPDATE ON payment_attempt DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_authorization_bundle();
CREATE CONSTRAINT TRIGGER evidence_authorization_bundle AFTER INSERT ON payment_evidence DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_authorization_bundle();
CREATE CONSTRAINT TRIGGER quote_authorization_bundle AFTER UPDATE ON quote DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.status = 'paid') EXECUTE FUNCTION check_authorization_bundle();

CREATE FUNCTION guard_scoped_references() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'session' THEN
    IF NEW.role = 'worker' THEN
      IF NOT EXISTS (SELECT 1 FROM agent_run WHERE id = NEW.run_id AND owner_id = NEW.owner_id) THEN RAISE EXCEPTION 'WORKER_SESSION_SCOPE_MISMATCH'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'job' THEN
    IF (NEW.kind = 'run' AND NOT EXISTS (SELECT 1 FROM agent_run WHERE id = NEW.entity_id))
      OR (NEW.kind = 'reconcile' AND NOT EXISTS (SELECT 1 FROM payment_attempt WHERE id = NEW.entity_id))
      OR (NEW.kind = 'wallet_observe' AND NOT EXISTS (SELECT 1 FROM wallet_operation WHERE id = NEW.entity_id))
      OR (NEW.kind = 'claim_observe' AND NOT EXISTS (SELECT 1 FROM merchant_claim WHERE id = NEW.entity_id)) THEN RAISE EXCEPTION 'JOB_ENTITY_MISMATCH'; END IF;
  ELSIF TG_TABLE_NAME = 'wallet_operation' THEN
    IF (NEW.role = 'owner' AND NOT EXISTS (SELECT 1 FROM agent a JOIN owner o ON o.id = a.owner_id WHERE a.id = NEW.agent_id AND o.wallet_address = NEW.actor_address))
      OR (NEW.role = 'merchant' AND NOT EXISTS (SELECT 1 FROM merchant WHERE wallet_address = NEW.actor_address)) THEN RAISE EXCEPTION 'WALLET_ACTOR_MISMATCH'; END IF;
  ELSIF TG_TABLE_NAME = 'merchant_claim' THEN
    IF NOT EXISTS (SELECT 1 FROM wallet_operation w JOIN merchant m ON m.wallet_address = w.actor_address
      WHERE w.id = NEW.wallet_operation_id AND m.id = NEW.merchant_id AND w.role = 'merchant' AND w.operation_kind = 'claim') THEN RAISE EXCEPTION 'CLAIM_WALLET_MISMATCH'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER session_scope_guard BEFORE INSERT OR UPDATE ON session FOR EACH ROW EXECUTE FUNCTION guard_scoped_references();
CREATE TRIGGER job_entity_guard BEFORE INSERT OR UPDATE ON job FOR EACH ROW EXECUTE FUNCTION guard_scoped_references();
CREATE TRIGGER wallet_actor_guard BEFORE INSERT OR UPDATE ON wallet_operation FOR EACH ROW EXECUTE FUNCTION guard_scoped_references();
CREATE TRIGGER claim_wallet_guard BEFORE INSERT OR UPDATE ON merchant_claim FOR EACH ROW EXECUTE FUNCTION guard_scoped_references();

-- Wallet operations are reviewable signed intents. Auth/signature/network/handoff
-- execution remains TASK-004, but a prepared operation cannot be retargeted in SQL.
CREATE FUNCTION guard_wallet_intent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW.actor_address,NEW.role,NEW.agent_id,NEW.operation_kind,NEW.operation_payload,NEW.unsigned_body_hash,NEW.expires_at,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.actor_address,OLD.role,OLD.agent_id,OLD.operation_kind,OLD.operation_payload,OLD.unsigned_body_hash,OLD.expires_at,OLD.created_at)
    OR (OLD.handoff_committed_at IS NOT NULL AND NEW.handoff_committed_at IS DISTINCT FROM OLD.handoff_committed_at)
    OR (OLD.tx_hash IS NOT NULL AND NEW.tx_hash IS DISTINCT FROM OLD.tx_hash)
    OR (OLD.status IN ('confirmed','failed','expired') AND NEW.status <> OLD.status)
    OR (NEW.handoff_committed_at IS NOT NULL AND NEW.status IN ('prepared','expired')) THEN RAISE EXCEPTION 'IMMUTABLE_WALLET_INTENT'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER wallet_intent_guard BEFORE UPDATE ON wallet_operation FOR EACH ROW EXECUTE FUNCTION guard_wallet_intent();
