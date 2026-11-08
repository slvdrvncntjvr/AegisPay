-- Authorization is final. A later observation error cannot overwrite the saved
-- successful provider status while retaining an authorized label.
CREATE FUNCTION guard_authorized_provider_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.status = 'authorized' OR OLD.status = 'authorized') AND NEW.velo_status IS DISTINCT FROM 'succeeded' THEN
    RAISE EXCEPTION 'AUTHORIZED_PROVIDER_STATE_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER authorized_provider_guard BEFORE UPDATE ON payment_attempt FOR EACH ROW EXECUTE FUNCTION guard_authorized_provider_state();
