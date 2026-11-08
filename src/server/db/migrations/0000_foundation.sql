CREATE TABLE "agent" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"device_hash" char(64) NOT NULL,
	"network" text NOT NULL,
	"device_contract_id" text NOT NULL,
	"agent_contract_id" text NOT NULL,
	"escrow_contract_id" text NOT NULL,
	"asset_contract_id" text NOT NULL,
	"policy_max_stroops" numeric NOT NULL,
	"policy_expires_at" timestamp with time zone NOT NULL,
	"policy_observed_ledger" bigint,
	"status" text NOT NULL,
	"last_nonce" numeric DEFAULT '0' NOT NULL,
	"lease_owner" text,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_public_key_unique" UNIQUE("public_key"),
	CONSTRAINT "agent_device_hash_unique" UNIQUE("device_hash"),
	CONSTRAINT "agent_owner_identity" UNIQUE("id","owner_id"),
	CONSTRAINT "agent_device_hash" CHECK (device_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "agent_key" CHECK (public_key ~ '^G[A-Z2-7]{55}$'),
	CONSTRAINT "agent_testnet" CHECK (network = 'testnet'),
	CONSTRAINT "agent_status" CHECK (status IN ('unprovisioned','active','revoked','disabled')),
	CONSTRAINT "agent_policy_amount" CHECK (policy_max_stroops = trunc(policy_max_stroops) AND policy_max_stroops >= 0 AND policy_max_stroops <= 170141183460469231731687303715884105727),
	CONSTRAINT "agent_nonce" CHECK (last_nonce = trunc(last_nonce) AND last_nonce >= 0 AND last_nonce <= 18446744073709551615),
	CONSTRAINT "agent_ledger" CHECK (policy_observed_ledger IS NULL OR policy_observed_ledger > 0),
	CONSTRAINT "agent_active_policy" CHECK (status <> 'active' OR (policy_max_stroops > 0 AND policy_observed_ledger IS NOT NULL)),
	CONSTRAINT "agent_lease" CHECK ((lease_owner IS NULL) = (lease_until IS NULL)),
	CONSTRAINT "agent_device_contract" CHECK (device_contract_id ~ '^C[A-Z2-7]{55}$'),
	CONSTRAINT "agent_agent_contract" CHECK (agent_contract_id ~ '^C[A-Z2-7]{55}$'),
	CONSTRAINT "agent_escrow_contract" CHECK (escrow_contract_id ~ '^C[A-Z2-7]{55}$'),
	CONSTRAINT "agent_asset_contract" CHECK (asset_contract_id ~ '^C[A-Z2-7]{55}$')
);
--> statement-breakpoint
CREATE TABLE "agent_run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"run_start_key" uuid NOT NULL,
	"status" text NOT NULL,
	"task_text" text NOT NULL,
	"budget_stroops" numeric NOT NULL,
	"reserved_stroops" numeric DEFAULT '0' NOT NULL,
	"spent_stroops" numeric DEFAULT '0' NOT NULL,
	"model_id" text NOT NULL,
	"model_turns" integer DEFAULT 0 NOT NULL,
	"tool_steps" integer DEFAULT 0 NOT NULL,
	"tool_checkpoint" jsonb,
	"final_answer" text,
	"error_code" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_owner_key" UNIQUE("owner_id","run_start_key"),
	CONSTRAINT "run_full_identity" UNIQUE("id","agent_id","owner_id"),
	CONSTRAINT "run_status" CHECK (status IN ('queued','running','waiting_payment','completed','failed')),
	CONSTRAINT "run_budget" CHECK (budget_stroops = trunc(budget_stroops) AND budget_stroops > 0 AND budget_stroops <= 170141183460469231731687303715884105727),
	CONSTRAINT "run_reserved" CHECK (reserved_stroops = trunc(reserved_stroops) AND reserved_stroops >= 0 AND reserved_stroops <= 170141183460469231731687303715884105727),
	CONSTRAINT "run_spent" CHECK (spent_stroops = trunc(spent_stroops) AND spent_stroops >= 0 AND spent_stroops <= 170141183460469231731687303715884105727),
	CONSTRAINT "run_budget_limit" CHECK (spent_stroops + reserved_stroops <= budget_stroops AND budget_stroops <= 1000000),
	CONSTRAINT "run_bounds" CHECK (model_turns BETWEEN 0 AND 8 AND tool_steps BETWEEN 0 AND 12 AND length(task_text) BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_id" text NOT NULL,
	"entity_kind" text NOT NULL,
	"entity_id" text NOT NULL,
	"kind" text NOT NULL,
	"correlation_id" text NOT NULL,
	"safe_metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_throttle" (
	"key_hash" char(64) PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"attempts" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "throttle_hash" CHECK (key_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "throttle_bounds" CHECK (attempts >= 0 AND expires_at > window_start)
);
--> statement-breakpoint
CREATE TABLE "entitlement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"quote_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"resource_key" text NOT NULL,
	"fixture_version" text NOT NULL,
	"receipt_token_hash" char(64) NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"first_delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entitlement_quote_id_unique" UNIQUE("quote_id"),
	CONSTRAINT "entitlement_evidence_id_unique" UNIQUE("evidence_id"),
	CONSTRAINT "entitlement_receipt_token_hash_unique" UNIQUE("receipt_token_hash"),
	CONSTRAINT "entitlement_token" CHECK (receipt_token_hash ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"lease_owner" text,
	"lease_until" timestamp with time zone,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_kind_entity" UNIQUE("kind","entity_id"),
	CONSTRAINT "job_kind" CHECK (kind IN ('run','reconcile','wallet_observe','claim_observe')),
	CONSTRAINT "job_status" CHECK (status IN ('queued','leased','done')),
	CONSTRAINT "job_attempt_count" CHECK (attempt_count >= 0),
	CONSTRAINT "job_lease" CHECK ((status = 'leased' AND lease_owner IS NOT NULL AND lease_until IS NOT NULL) OR (status <> 'leased' AND lease_owner IS NULL AND lease_until IS NULL))
);
--> statement-breakpoint
CREATE TABLE "merchant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"wallet_address" text NOT NULL,
	"allowlisted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_wallet_address_unique" UNIQUE("wallet_address"),
	CONSTRAINT "merchant_wallet" CHECK (wallet_address ~ '^G[A-Z2-7]{55}$')
);
--> statement-breakpoint
CREATE TABLE "merchant_claim" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"asset_contract_id" text NOT NULL,
	"wallet_operation_id" uuid NOT NULL,
	"tx_hash" char(64),
	"observed_claim_amount_stroops" numeric,
	"status" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_claim_wallet_operation_id_unique" UNIQUE("wallet_operation_id"),
	CONSTRAINT "merchant_claim_tx_hash_unique" UNIQUE("tx_hash"),
	CONSTRAINT "claim_asset" CHECK (asset_contract_id ~ '^C[A-Z2-7]{55}$'),
	CONSTRAINT "claim_hash" CHECK (tx_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "claim_amount" CHECK (observed_claim_amount_stroops = trunc(observed_claim_amount_stroops) AND observed_claim_amount_stroops >= 0 AND observed_claim_amount_stroops <= 170141183460469231731687303715884105727),
	CONSTRAINT "claim_status" CHECK (status IN ('prepared','submitting','unknown','confirmed','failed')),
	CONSTRAINT "claim_confirmation" CHECK (status <> 'confirmed' OR (tx_hash IS NOT NULL AND confirmed_at IS NOT NULL AND observed_claim_amount_stroops IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "owner" (
	"id" uuid PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owner_wallet_address_unique" UNIQUE("wallet_address"),
	CONSTRAINT "owner_wallet" CHECK (wallet_address ~ '^G[A-Z2-7]{55}$')
);
--> statement-breakpoint
CREATE TABLE "payment_attempt" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"client_idempotency_key" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"nonce" numeric NOT NULL,
	"status" text NOT NULL,
	"signed_xdr_fingerprint" char(64),
	"signed_xdr_ciphertext" "bytea",
	"cipher_iv" "bytea",
	"cipher_tag" "bytea",
	"encryption_key_version" text,
	"velo_request_id" text,
	"inner_hash" char(64),
	"outer_hash" char(64),
	"velo_status" text,
	"handoff_committed_at" timestamp with time zone,
	"next_check_at" timestamp with time zone,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempt_quote_id_unique" UNIQUE("quote_id"),
	CONSTRAINT "payment_attempt_operation_id_unique" UNIQUE("operation_id"),
	CONSTRAINT "payment_attempt_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "payment_attempt_velo_request_id_unique" UNIQUE("velo_request_id"),
	CONSTRAINT "payment_attempt_inner_hash_unique" UNIQUE("inner_hash"),
	CONSTRAINT "payment_attempt_outer_hash_unique" UNIQUE("outer_hash"),
	CONSTRAINT "attempt_owner_client_key" UNIQUE("owner_id","client_idempotency_key"),
	CONSTRAINT "attempt_agent_nonce" UNIQUE("agent_id","nonce"),
	CONSTRAINT "attempt_nonce" CHECK (nonce = trunc(nonce) AND nonce > 0 AND nonce <= 18446744073709551615),
	CONSTRAINT "attempt_status" CHECK (status IN ('accepted','preparing','signed','sponsoring','reserved','submitting','submitted','authorized','unknown','refused','expired','failed','manual_review')),
	CONSTRAINT "attempt_provider_key" CHECK (idempotency_key = 'aegispay:' || operation_id::text),
	CONSTRAINT "attempt_signed_xdr_fingerprint" CHECK (signed_xdr_fingerprint ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "attempt_inner_hash" CHECK (inner_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "attempt_outer_hash" CHECK (outer_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "attempt_cipher" CHECK ((signed_xdr_ciphertext IS NULL AND cipher_iv IS NULL AND cipher_tag IS NULL AND encryption_key_version IS NULL) OR (signed_xdr_ciphertext IS NOT NULL AND cipher_iv IS NOT NULL AND cipher_tag IS NOT NULL AND octet_length(cipher_iv) = 12 AND octet_length(cipher_tag) = 16 AND encryption_key_version IS NOT NULL AND signed_xdr_fingerprint IS NOT NULL)),
	CONSTRAINT "attempt_handoff" CHECK (handoff_committed_at IS NULL OR (velo_request_id IS NOT NULL AND inner_hash IS NOT NULL AND signed_xdr_ciphertext IS NULL))
);
--> statement-breakpoint
CREATE TABLE "payment_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"inner_hash" char(64) NOT NULL,
	"outer_hash" char(64),
	"observed_event_tx_hash" char(64) NOT NULL,
	"noir_event_id" text NOT NULL,
	"network" text NOT NULL,
	"contract_id" text NOT NULL,
	"ledger_sequence" bigint NOT NULL,
	"ledger_closed_at" timestamp with time zone NOT NULL,
	"agent_public_key" text NOT NULL,
	"device_hash" char(64) NOT NULL,
	"merchant_address" text NOT NULL,
	"asset_contract_id" text NOT NULL,
	"amount_stroops" numeric NOT NULL,
	"nonce" numeric NOT NULL,
	"actual_fee_stroops" numeric,
	"fee_provenance" text DEFAULT 'unavailable' NOT NULL,
	"evidence_digest" char(64) NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payment_evidence_attempt_id_unique" UNIQUE("attempt_id"),
	CONSTRAINT "payment_evidence_inner_hash_unique" UNIQUE("inner_hash"),
	CONSTRAINT "payment_evidence_outer_hash_unique" UNIQUE("outer_hash"),
	CONSTRAINT "payment_evidence_noir_event_id_unique" UNIQUE("noir_event_id"),
	CONSTRAINT "evidence_amount" CHECK (amount_stroops = trunc(amount_stroops) AND amount_stroops > 0 AND amount_stroops <= 170141183460469231731687303715884105727),
	CONSTRAINT "evidence_fee" CHECK (actual_fee_stroops = trunc(actual_fee_stroops) AND actual_fee_stroops >= 0 AND actual_fee_stroops <= 170141183460469231731687303715884105727),
	CONSTRAINT "evidence_nonce" CHECK (nonce = trunc(nonce) AND nonce > 0 AND nonce <= 18446744073709551615),
	CONSTRAINT "evidence_network" CHECK (network = 'testnet'),
	CONSTRAINT "evidence_ledger" CHECK (ledger_sequence > 0),
	CONSTRAINT "evidence_hash_mapping" CHECK (observed_event_tx_hash = inner_hash OR (outer_hash IS NOT NULL AND observed_event_tx_hash = outer_hash)),
	CONSTRAINT "evidence_fee_source" CHECK ((actual_fee_stroops IS NULL AND fee_provenance = 'unavailable') OR (actual_fee_stroops IS NOT NULL AND fee_provenance IN ('outer_ledger','outer_ledger_and_velo'))),
	CONSTRAINT "evidence_inner_hash" CHECK (inner_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "evidence_outer_hash" CHECK (outer_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "evidence_observed_event_tx_hash" CHECK (observed_event_tx_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "evidence_device_hash" CHECK (device_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "evidence_evidence_digest" CHECK (evidence_digest ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "evidence_agent" CHECK (agent_public_key ~ '^G[A-Z2-7]{55}$'),
	CONSTRAINT "evidence_merchant" CHECK (merchant_address ~ '^G[A-Z2-7]{55}$'),
	CONSTRAINT "evidence_contract" CHECK (contract_id ~ '^C[A-Z2-7]{55}$'),
	CONSTRAINT "evidence_asset" CHECK (asset_contract_id ~ '^C[A-Z2-7]{55}$')
);
--> statement-breakpoint
CREATE TABLE "quote" (
	"id" uuid PRIMARY KEY NOT NULL,
	"resource_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"resource_key" text NOT NULL,
	"fixture_version" text NOT NULL,
	"merchant_address" text NOT NULL,
	"amount_stroops" numeric NOT NULL,
	"asset_contract_id" text NOT NULL,
	"network" text NOT NULL,
	"device_hash" char(64) NOT NULL,
	"agent_public_key" text NOT NULL,
	"terms_hash" char(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_owner_agent" UNIQUE("id","owner_id","agent_id"),
	CONSTRAINT "quote_amount" CHECK (amount_stroops = trunc(amount_stroops) AND amount_stroops > 0 AND amount_stroops <= 170141183460469231731687303715884105727),
	CONSTRAINT "quote_network" CHECK (network = 'testnet'),
	CONSTRAINT "quote_status" CHECK (status IN ('open','accepted','paid','expired','refused')),
	CONSTRAINT "quote_terms" CHECK (terms_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "quote_device" CHECK (device_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "quote_agent" CHECK (agent_public_key ~ '^G[A-Z2-7]{55}$'),
	CONSTRAINT "quote_merchant" CHECK (merchant_address ~ '^G[A-Z2-7]{55}$'),
	CONSTRAINT "quote_asset" CHECK (asset_contract_id ~ '^C[A-Z2-7]{55}$'),
	CONSTRAINT "quote_lifetime" CHECK (expires_at > created_at AND expires_at <= created_at + interval '120 seconds'),
	CONSTRAINT "quote_acceptance" CHECK ((status IN ('open','expired','refused') OR accepted_at IS NOT NULL) AND (accepted_at IS NULL OR accepted_at < expires_at))
);
--> statement-breakpoint
CREATE TABLE "resource" (
	"id" uuid PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"resource_key" text NOT NULL,
	"route_slug" text NOT NULL,
	"description" text NOT NULL,
	"price_stroops" numeric NOT NULL,
	"asset_contract_id" text NOT NULL,
	"fixture_version" text NOT NULL,
	"is_demo" boolean NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_resource_key_unique" UNIQUE("resource_key"),
	CONSTRAINT "resource_route_slug_unique" UNIQUE("route_slug"),
	CONSTRAINT "resource_merchant_identity" UNIQUE("id","merchant_id"),
	CONSTRAINT "resource_price" CHECK (price_stroops = trunc(price_stroops) AND price_stroops > 0 AND price_stroops <= 170141183460469231731687303715884105727),
	CONSTRAINT "resource_demo" CHECK (is_demo = true),
	CONSTRAINT "resource_asset" CHECK (asset_contract_id ~ '^C[A-Z2-7]{55}$')
);
--> statement-breakpoint
CREATE TABLE "run_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"safe_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" char(64) NOT NULL,
	"role" text NOT NULL,
	"owner_id" uuid,
	"merchant_id" uuid,
	"run_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "session_hash" CHECK (token_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "session_scope" CHECK ((role = 'owner' AND owner_id IS NOT NULL AND merchant_id IS NULL AND run_id IS NULL) OR (role = 'merchant' AND merchant_id IS NOT NULL AND owner_id IS NULL AND run_id IS NULL) OR (role = 'worker' AND owner_id IS NOT NULL AND run_id IS NOT NULL AND merchant_id IS NULL)),
	CONSTRAINT "session_lifetime" CHECK (expires_at > created_at AND expires_at <= created_at + CASE WHEN role = 'worker' THEN interval '15 minutes' ELSE interval '8 hours' END)
);
--> statement-breakpoint
CREATE TABLE "wallet_operation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_address" text NOT NULL,
	"role" text NOT NULL,
	"agent_id" uuid,
	"operation_kind" text NOT NULL,
	"operation_payload" jsonb NOT NULL,
	"unsigned_body_hash" char(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"handoff_committed_at" timestamp with time zone,
	"tx_hash" char(64),
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_operation_tx_hash_unique" UNIQUE("tx_hash"),
	CONSTRAINT "wallet_actor" CHECK (actor_address ~ '^G[A-Z2-7]{55}$'),
	CONSTRAINT "wallet_body" CHECK (unsigned_body_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "wallet_tx" CHECK (tx_hash ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "wallet_status" CHECK (status IN ('prepared','submitting','unknown','confirmed','failed','expired')),
	CONSTRAINT "wallet_role_kind" CHECK ((role = 'merchant' AND operation_kind = 'claim' AND agent_id IS NULL) OR (role = 'owner' AND agent_id IS NOT NULL AND operation_kind IN ('registerDevice','registerAgent','fundEscrow','defundEscrow','revokeAgent','sweepOnRevoke'))),
	CONSTRAINT "wallet_handoff" CHECK (handoff_committed_at IS NULL OR tx_hash IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_agent_id_owner_id_agent_id_owner_id_fk" FOREIGN KEY ("agent_id","owner_id") REFERENCES "public"."agent"("id","owner_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_evidence_id_payment_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."payment_evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_claim" ADD CONSTRAINT "merchant_claim_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_claim" ADD CONSTRAINT "merchant_claim_wallet_operation_id_wallet_operation_id_fk" FOREIGN KEY ("wallet_operation_id") REFERENCES "public"."wallet_operation"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempt" ADD CONSTRAINT "payment_attempt_quote_id_owner_id_agent_id_quote_id_owner_id_agent_id_fk" FOREIGN KEY ("quote_id","owner_id","agent_id") REFERENCES "public"."quote"("id","owner_id","agent_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_evidence" ADD CONSTRAINT "payment_evidence_attempt_id_payment_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempt"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_run_id_agent_id_owner_id_agent_run_id_agent_id_owner_id_fk" FOREIGN KEY ("run_id","agent_id","owner_id") REFERENCES "public"."agent_run"("id","agent_id","owner_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_resource_id_merchant_id_resource_id_merchant_id_fk" FOREIGN KEY ("resource_id","merchant_id") REFERENCES "public"."resource"("id","merchant_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_event" ADD CONSTRAINT "run_event_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_merchant_id_merchant_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_operation" ADD CONSTRAINT "wallet_operation_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_run_per_agent" ON "agent_run" USING btree ("agent_id") WHERE status IN ('queued','running','waiting_payment');--> statement-breakpoint
CREATE INDEX "entitlement_owner_window" ON "entitlement" USING btree ("owner_id","valid_until");--> statement-breakpoint
CREATE INDEX "job_available" ON "job" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_attempt_per_agent" ON "payment_attempt" USING btree ("agent_id") WHERE status NOT IN ('authorized','refused','expired','failed');--> statement-breakpoint
CREATE INDEX "attempt_reconcile" ON "payment_attempt" USING btree ("status","next_check_at");--> statement-breakpoint
CREATE INDEX "quote_run_created" ON "quote" USING btree ("run_id","created_at");--> statement-breakpoint
CREATE INDEX "run_event_order" ON "run_event" USING btree ("run_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_unresolved_wallet_per_actor" ON "wallet_operation" USING btree ("actor_address") WHERE status IN ('prepared','submitting','unknown');