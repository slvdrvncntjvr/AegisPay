CREATE TABLE "payment_accept_key" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"client_key" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accept_key_owner_key" UNIQUE("owner_id","client_key")
);
--> statement-breakpoint
ALTER TABLE "payment_accept_key" ADD CONSTRAINT "payment_accept_key_owner_id_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owner"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_accept_key" ADD CONSTRAINT "payment_accept_key_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_accept_key" ADD CONSTRAINT "payment_accept_key_attempt_id_payment_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempt"("id") ON DELETE restrict ON UPDATE no action;

CREATE FUNCTION guard_acceptance_key() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM payment_attempt WHERE id = NEW.attempt_id AND quote_id = NEW.quote_id AND owner_id = NEW.owner_id) THEN
    RAISE EXCEPTION 'ACCEPTANCE_KEY_SCOPE_MISMATCH';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER accept_key_scope BEFORE INSERT ON payment_accept_key FOR EACH ROW EXECUTE FUNCTION guard_acceptance_key();
CREATE TRIGGER accept_key_immutable BEFORE UPDATE OR DELETE ON payment_accept_key FOR EACH ROW EXECUTE FUNCTION deny_financial_mutation();
