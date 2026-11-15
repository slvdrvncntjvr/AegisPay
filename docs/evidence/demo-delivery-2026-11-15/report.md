# Usable hosted Testnet demo delivered

**Open [aegispay-finals-app.onrender.com/login](https://aegispay-finals-app.onrender.com/login).** The owner and merchant use their unchanged login tokens in protected `.fmd-work/release-setup/hosted-access.md`. See the concise [operator handoff](../../demo-handoff.md). No additional rehearsal payment is required for this user-selected handoff.

## Deployment and active authority

Two exact Free Node services in the verified AegisPay Finals workspace are live in Singapore: `aegispay-finals-app` and `aegispay-finals-worker`. Autodeploy is off; both run exact source `d42cb96d43e2c82e98cb2bd8eba8b8637809f0c9`, Node24.22.1 and locked pnpm12.18.0. Sanitized build children receive no service secrets. Initial builds were fenced until explicit configuration. [Configuration](configuration.json), [web live readback](deployment-web-1794715421767.json), [worker live readback](deployment-worker-1794715420419.json), [worker activation live](activation-1794716013733.json).

The worker runs with explicit Testnet execution enabled after history cutover and exposes only authenticated machine wake plus public health. Signer/Gemini/Velo/encryption keys remain worker-only; login tokens remain web-only; necessary database/receipt/wake inputs are shared privately. PostgreSQL uses the exact independent Free database created earlier, with verified external TLS. Network access preserves the coordinator's existing/32 rule and adds only the two provider-observed Singapore egress ranges, each at least/24; those are shared regional egress, not service-exclusive ranges. No all-internet rule or paid feature was added. Prior proof/preview/original resources are unchanged.

The active authority is now hosted. The exact owned local web/worker were stopped after PID, executable, arguments and creation-time checks. Local3019/3020 are retired, and the source database defaults to read-only for new connections. Closing the local windows interrupted Docker; after the user's continue instruction, Docker Desktop and its exact existing owned container were recovered without creating a new container or volume. Hosted services remained live throughout the local application closure.

## Preserved history and cutover recovery

The first direct-insert copy rolled back on QUOTE_SNAPSHOT_MISMATCH: application creation guards correctly require new, current-price/open quotes and current policy/deadline state, whereas the source contains a genuine historical paid0.03quote and current0.04offer. Replaying creation would falsify history and fail expired-operation guards. No financial row was committed by that attempt.

Use the native PostgreSQL17.11 archive instead: pg_dump captured the exact invocation-owned source; pg_restore reconstructed schema,data,constraints,triggers and sequences in one transaction on the independently verified empty target, using no owner/privilege transfer and strict TLS. No `--disable-triggers` or session replication bypass was used. The target's previous empty schema was replaced; source/original/preview databases were never dropped or reset. The archive is private and user-ACL protected, never checked into Git. [Native cutover verification](history-native-cutover.json).

Post-restore exact row comparisons match all17application tables and migration history. Nonce1, one authorized attempt, one evidence row, one entitlement, one separate merchant claim, both model runs, old expired wallet preparations, accepted quote, event history and original timestamps are preserved. All13function definitions and23enabled application trigger definitions match. All155constraints match; PostgreSQL's SQL roundtrip regrouped AND parentheses in run_bounds only, so comparison explicitly requires the same six bounds and rejects every other remaining token/operator. No SQL constraint was weakened. Both serial sequence states match. Two copied active sessions were revoked so local cookies do not transfer authority across origins.

The normal verified data include a completed0.03XLM model purchase/report and separate0.03XLM native merchant payout. They were not fabricated, regenerated or replayed during migration. Current escrow remains0.07XLM, merchant pending0, future QuickSignal0.04XLM, paid quote0.03XLM. No new payment handoff occurred in deployment. The old report window remains expired and is not extended by the move.

## Operational acceptance

[Final hosted check](hosted-handoff-check.json) passes47actual checks, including both HTTPS health endpoints, wrong-origin login rejection, anonymous state/wake denial, secure HttpOnly SameSite cookies, actual owner/merchant login/logout, preserved role-specific data and price, same-identity receipt recovery, unchanged expired report window, authenticated wake, actual database TLS and unchanged financial fingerprints. Both test sessions are revoked. Four desktop/mobile role views render without horizontal overflow. No run,quote,wallet preparation or financial transaction was created.

The [first handoff check](hosted-handoff-first-failed.json) incorrectly expected receiptId in the state-list projection; that identity is intentionally returned by the original-payment observation endpoint. The assertion was corrected to use that actual endpoint. Its one test session was revoked. This was a checker correction, not a data or application repair.

[Public asset inspection](public-assets.json) passes two hosted HTML pages and9client JavaScript assets, with zero matches for known credential values or Stellar secret-seed literals. No private report body, provider thoughts, cookies, receipt tokens, passwords or signed XDR is stored in public evidence. This is a bounded operational scan, not a claim of exhaustive production certification.

## Handoff scope and ordinary operation

TASK-033 completes the user-selected usable Testnet demo. The user explicitly chose to stop extra local rehearsal after the first real model-driven purchase/report and merchant payout. Broader full-MVP second-purchase/refusal/price-choice/revoke/reclaim/hosted-payment/media qualification remains deferred and unclaimed. Hosted operational checks are complete; no additional test transaction is needed for this handoff.

The owner policy has expired. Renewing it in Freighter is normal consent before a future purchase, not a remaining deployment test. Original lifetime funding authority is exhausted; keep the existing escrow. Unknown financial outcomes remain held and are observed by saved identity. Free instances may cold-start, and the Free database expiresDecember14,2026; preserve current hosted history before expiry or move to durable database hosting. The cutover archive is a point-in-time backup and must not be used as a stale nonce reset after future payments.
