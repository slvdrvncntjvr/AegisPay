-- Internal diagnostic runs may have zero purchasing authority. Existing API
-- runs retain their default finite budget; no existing row is changed here.
ALTER TABLE agent_run DROP CONSTRAINT run_budget;
ALTER TABLE agent_run ADD CONSTRAINT run_budget CHECK (
  budget_stroops = trunc(budget_stroops) AND budget_stroops >= 0
  AND budget_stroops <= 170141183460469231731687303715884105727
);
CREATE FUNCTION guard_run_budget_authority() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.budget_stroops > OLD.budget_stroops THEN
    RAISE EXCEPTION 'RUN_BUDGET_CANNOT_INCREASE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER run_budget_authority_guard BEFORE UPDATE ON agent_run
FOR EACH ROW EXECUTE FUNCTION guard_run_budget_authority();
