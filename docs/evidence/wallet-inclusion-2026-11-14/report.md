# Included registration recovered without another signature

The user's current owner registration succeeded on Stellar Testnet at ledger5728971, transaction `1a90bea9260d2043fb62a5b26ded7ac4dd8a6426f51955d3767cfe44ce19b288`, included2026-11-14T15:01:39Z. RPC and independent Horizon agree. Device owner GAXQ…NZS7 and configured independent agent GBN5…IAII match actual contract reads. [Identity-only observation](registration-observed.json).

The saved handoff committed before its time bound. The verifier previously required a numeric `createdAt`, while actual RPC returned decimal string `1794668499`. [Official RPC contract](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getTransaction) specifies a string. Installed Stellar SDK16.4.1 declares a number in `lib/esm/rpc/api.d.ts` but its parser copies `raw.createdAt` unchanged. Strict positive decimal-string normalization now supports that wire shape and existing numeric fixtures, rejecting malformed/unsafe values. All existing source/body/hash/signature/invocation/inclusion/result/contract checks remain required.

The real domain observer verified the original envelope and changed only the existing operation from unknown to confirmed. No new preparation, signature, submission, nonce or purchase was created. Its existing observation job subsequently finished. The two earlier unsigned registrations remain expired historical records; expiration of an unsigned preparation does not expire an included transaction.

## Validation and running app

- Focused PostgreSQL wallet-worker gate:15/15 pass, including string-timestamp success/failure and malformed-value holds. Full PostgreSQL suite:155/155 pass,11files,exit0. Chain transport in these tests is synthetic; the actual registration read above is separate.
- `corepack.cmd pnpm typecheck`, `corepack.cmd pnpm lint`, `corepack.cmd pnpm build`:exit0.
- Exact saved web/worker PIDs, executable, arguments and creation times were checked before stopping them for production rebuild. The narrow resume guard requires this exact confirmed registration, completed observation job, unprovisioned zero policy/nonce and no run/quote/payment/claim history. [Startup receipt](setup-registration-confirmed-startup.json). Local3019/3020 run the repaired source; persistent purchase dispatch remains disabled.
- [Actual authenticated browser readback](authenticated-readback.json) passes7checks: current owner/state, confirmed badge, existing status check, actual chain refresh, unchanged wallet/job/financial counts and logout. Its test session is revoked. [Screenshot](registration-confirmed.png). The first browser assertion incorrectly expected internal `confirmed` instead of visible `Confirmed on chain`; [failed receipt](authenticated-readback-first-failed.json) is preserved and its session revoked. Correcting the assertion required no app or state repair.

## Remaining human setup

At http://127.0.0.1:3019/app, hard-refresh. The latest registration should show **Confirmed on chain**; retain the old expired entry as history. Select **Set finite policy**, cap1000000stroops (0.1TestnetXLM), expiry about30minutes ahead within one hour. Prepare, review, and explicitly sign in Freighter using owner GAXQ…NZS7 on Testnet. Check that operation's status until confirmed. Then select **Fund escrow**, amount1000000stroops, prepare/review/sign once, and check that operation's status. Refresh chain observation afterwards.

Each signature is human-controlled. Do not prepare another registration. If a submitted action stays unknown, keep its saved identity and observe it rather than submitting another transaction. Escrow funding has a lifetime1000000-stroop ceiling; spend/reclaim does not replenish it. Keep the distinct merchant account GAD7…XCHK for its later separate claim.

TASK-028 completes transport compatibility and this exact registration recovery. Policy, escrow funding, actual app model/purchase/refusal/recovery, merchant claim, revoke/reclaim and complete hosted release remain unfinished. The original unrelated unknown payment stays held/unentitled and untouched. This is not complete live MVP acceptance.
