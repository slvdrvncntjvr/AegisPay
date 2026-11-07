# Change record

## Doc lifecycle

Execution specifications are **Draft** at handoff: build decisions are selected, but live assumptions have not passed. On the first successful integration gate, the active implementer may mark affected contracts Locked with evidence. Draft refinements require canonical reconciliation; material changes to a Locked specification require an appended CR entry here.

## Initial issue — 2026-11-07

Initial document generation is not a change to a previously Locked document, so no fictional CR is created. The original idea is preserved with a dated stable-ID addendum. Initial choices and rejected approaches are in [the ledger](DECISION-LEDGER.md).

For a future change, append its unique CR ID, date, author, affected locked document/sections, old and new behavior, reason/evidence, affected feature/invariant/test/task IDs and reconciliation outcome. Do not overwrite past entries. Routine task status needs no CR.

## Draft handbook reconciliation — 2026-11-07

Specs remain Draft; no affected document was marked Locked. This is a lifecycle note, not a fictional locked-document CR. The handbook adds mandatory real workspaces/public hosting/ordered materials and resolves the October 24 tuple; the significant decision is appended to the ledger, original compact-package choice retained as history, and TASK-011 through TASK-013 appended without renumbering. F-005 and INV-001 through INV-010 remain unchanged. If later evidence establishes a prior affected lock, append a proper CR identifying that lock and affected sections before material change.
