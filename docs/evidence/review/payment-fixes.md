# TASK-002 payment review fixes

Date: 2026-11-07. Branch: `slvdrvncntjvr/task-002-review-fixes`, based on `5ab900f` (`54ef3f0` plus the supplied ignore-only commit).

Changed files: `src/server/integrations/spike-journal.ts`, `src/server/integrations/stellar-evidence.ts`, `tests/testnet/journal.test.ts`, `tests/testnet/evidence.test.ts`, `tests/testnet/driver.test.ts`, and this report.

The journal retries ciphertext deletion when loading a durable terminal refusal and when repeating the same refusal. It preserves the original decision/code/timestamp, rejects a different refusal or a financial decision, rechecks the decision before decrypting, and rejects a handoff loser when refusal won. Envelope saves recheck the decision after writing; late ciphertext is removed. Partial records still fail closed. No decision record is overwritten.

EQ-004 now reads `transaction.resultXdr.feeCharged()` from the independently verified outer result, preserves `outerLedgerFeeChargedStroops` and `veloActualFeeStroops`, and returns `actualFeeStroops` only on equality. `actualFeeStatus` is `matched`, `velo_unavailable`, or `conflict`; null/conflicting fee metrics do not remove a separately verified authorization. Existing invocation, signature, intent, embedded-event and hash checks remain in place.

Observed gates:

- Frozen install: `npm.cmd exec --yes --package=pnpm@12.18.0 -- pnpm install --frozen-lockfile`, exit 0; pins and lockfile unchanged.
- Tests first: `npm.cmd run test:spike`, exit 1, 41 passed / 5 failed. Failures reproduced interrupted refusal cleanup, failed unlink recovery, late envelope save cleanup, repeat refusal after a race, and missing independent fee provenance.
- Before the fee fix, `node --import tsx --test tests/testnet/evidence.test.ts`, exit 1, 6 passed / 1 failed; the conflict assertion observed `'99'` instead of null.
- After fixes and additional coverage: `npm.cmd run test:spike`, exit 0, 50 passed / 0 failed / 0 skipped. Tests include actual injected EACCES unlink failure followed by recovery, interrupted cleanup, immutable refusal, partial marker, refusal/handoff and envelope read/save races, and driver restart blocking prepare/sign/Gas calls. Synthetic pinned SDK 16.4.1 result XDR includes an invoke-host-function operation result and codec round-trip; normal and fee-bump cases cover matching/null/conflicting Velo fees and distinct outer (200) / inner (0) fees.
- `npm.cmd run typecheck`: exit 0.
- `npm.cmd run lint`: exit 0.
- `python tools/check-docs.py`: exit 0.
- `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict`: exit 0.

Limits: verification was offline using synthetic fixtures and temporary journals. No live provider calls, new payments, live signing/submission, live-journal or environment-file reads, existing live-artifact changes, public push, canonical-document changes, or task-status changes occurred. Persistent unlink failure remains a blocking error with the terminal decision retained; a later recovery retries cleanup. This single-operation filesystem spike is not the future application database or its concurrency/release proof.
