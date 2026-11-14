# Application API specification

**Status:** proposed AegisPay contracts; not vendor SDK methods. Base URL is trusted `APP_ORIGIN`. Route handlers use Node runtime. Implement matching Zod schemas in `src/server/domain/protocol.ts`; machine-readable OpenAPI export is deferred for this private MVP.

## Overview

Amounts/nonces are unsigned decimal strings, timestamps ISO-8601 UTC, IDs UUIDs, wallet/contract IDs validated Stellar addresses. All JSON envelopes and errors have `Cache-Control: no-store`; protected resource responses are dynamic and never prefetched. Protocol is `aegispay-402/1`, not an x402-standard schema.

## Authentication & authorization

[Security](security-compliance.md) owns session establishment, roles, limits and origin checks. Browser APIs use an HttpOnly session. Worker calls use a short-lived opaque bearer scoped to a single owner/run; never accept browser-provided role or owner IDs. Mutating browser routes require exact configured Origin. Cross-origin CORS is disabled. Unauthorized gets 401 before quote issuance; cross-owner object lookup returns 404.

## Endpoints / operations

### API-001 — POST /api/session and DELETE /api/session — demo login/logout

Serves F-001, F-012. POST `{role: 'owner'|'merchant', token: string}` authenticates against that role's configured high-entropy login secret; returns 204 with cookie. DELETE revokes the session and clears cookie, 204. Auth: POST public but throttled, DELETE authenticated. No public signup, token echo or token in URL. A login role is mapped to configured owner/merchant, not selected wallet addresses. Errors: AUTH_INVALID, RATE_LIMITED, ORIGIN_DENIED.

### API-002 — GET /api/v1/state — console state

Serves F-001, F-002, F-003, F-010, F-011. Auth: owner gets only its agent/runs/attempts; merchant gets its offers/pending/claims and minimal transaction fields, never owner task text/session metadata. Response 200 with `{network, health, agent?, balances?, offers?, claims?, observedAt}`; each chain-derived value includes observed ledger/time or an unavailable marker. Never return ciphertext, agent-signed XDR or login secrets.

### API-003 — POST /api/v1/wallet-operations — prepare human-signed action

Serves F-001, F-002, F-003, F-011. Request discriminated union:

```text
{kind:'registerDevice'}
{kind:'registerAgent', maxAmountStroops:string, expiresAt:string}
{kind:'fundEscrow'|'defundEscrow', amountStroops:string}
{kind:'revokeAgent'|'sweepOnRevoke'}
{kind:'claim'}
```

Owner role allowed for lifecycle actions; merchant role only for claim. Device, source addresses and asset come from trusted configured context. Response 201 `{operationId, unsignedXdr, networkPassphrase, signerAddress, expiresAt}`. The XDR here is the owner's or merchant's reviewable transaction, never the agent's signed payment. Reject a zero cap, nonfuture expiry, unfunded dependency, wrong actor, or concurrent pending operation. `sweepOnRevoke` is prepared only after revocation confirms; no device-removal endpoint in MVP.

### API-004 — POST /api/v1/wallet-operations/:id/submit and GET /api/v1/wallet-operations/:id

Serves F-001, F-002, F-003, F-011. POST `{signedXdr:string}` after explicit Freighter signing; validate authenticated role, prepared body, source, network, bounds and valid signer, then commit handoff marker and submit once. Return 202 `{operationId,status}`. GET returns observed status/hash/safe error; idempotent repeat reads existing state. The body never enters logs or generic audit payload. Owner/merchant operations also recover by saved tx hash instead of blindly submitting again. Pending chain operations are not reported as completed. A status GET can mark an expired prepared operation as expired only when no handoff was committed, using DB time and the shared agent-before-wallet lock order. It never signs or submits. A handoff remains unresolved until independently observed; elapsed time alone does not terminate it.

### API-005 — GET /api/v1/catalog — two trusted public descriptions

Serves F-004, F-005. Auth: owner or scoped worker. Response 200 `{offers:[{resourceKey,description,priceStroops,assetContractId,isDemo:true}]}`. Exactly two enabled seeded demo resources; no protected report text or arbitrary outbound URLs.

### API-006 — POST /api/v1/runs and GET /api/v1/runs/:id

Serves F-005, F-010. Owner-only POST `{task:string}`; task budget comes from PRD default, not a model-written amount. Client sends `Idempotency-Key` generated once per Start action; persist `UNIQUE(owner_id, run_start_key)` on `agent_run` so a transport retry returns the same run. POST returns 202 `{runId,status}`; 409 if a different run is already active. GET returns task status, final answer and redacted references. It never starts another model loop. Rate limiting and chain readiness apply before enqueue.

### API-007 — GET /api/v1/runs/:id/events?after=:eventId

Serves F-005, F-010. Auth: owning session. Response 200 `{events:[{id,kind,safePayload,createdAt}],nextCursor}`; ascending cursor, at most 100 rows. A reconnect polls from saved cursor. No thought-chain content, credentials, raw provider exceptions or XDR.

`model_choice` is a bounded public-commentary event, distinct from trusted quote/payment fields. Its `safePayload` is exactly `{turn,decision,summary,summaryStatus}`: turn is an integer1–8; decision is `tools_proposed|no_tool`; summaryStatus is `provided|missing|withheld`. A provided summary is normalized plain text of at most280characters; missing/withheld requires summary:null. The consumer extracts only non-thought public adapter text before any protected report delivery and saves the event atomically with its validated provider turn. After report delivery, choice events are suppressed. Unsafe markup, URI, control, financial-status or credential-like prose is withheld. This conservative presentation check does not establish factuality. UI labels the text untrusted model commentary; `no_tool` records only the absence of a proposed tool in that turn. Provider continuation/thought/signature/tool payloads remain private. Existing auth/cursor/no-store behavior and historical event kinds remain supported; unknown fields are stripped and invalid events omitted while the cursor advances.

### API-008 — GET /api/demo/:provider?dependency=demo-parser&runId=:id

Serves F-004, F-009. `provider` allowlist is `quick-signal|deep-trace`; dependency is the single demo slug. Auth: owning session or scoped worker for that run. Without receipt, store a quote then return 402 with no report:

```json
{
  "protocol": "aegispay-402/1",
  "quoteId": "server-generated-uuid",
  "resourceKey": "quick-signal:demo-parser:v1",
  "network": "stellar:testnet",
  "assetContractId": "verified-configured-SAC",
  "amountStroops": "300000",
  "merchantAddress": "configured-merchant-address",
  "expiresAt": "server-generated-UTC-deadline"
}
```

The illustrative IDs/addresses above are explanatory, not deployable values. Optional `Aegis-Quote` header carries the quote ID. With `Aegis-Receipt` validate secret hash, expiry, owning session, exact quote/resource/fixture and return 200 `{isDemo:true,resourceKey,report,receiptId}`. Invalid receipt gets 403, not a fresh automatic payment. Equivalent paid read is exposed via API-011. Query alone can never mark a quote paid.

### API-009 — POST /api/v1/payment-attempts — accept quote and queue once

Serves F-006, F-007, F-008. Auth: owner or scoped worker; body `{quoteId:string}` and required UUID `Idempotency-Key`. Persist it as `client_idempotency_key` scoped to owner; the separately generated provider `idempotency_key` derives from immutable operation ID. Server derives terms; client cannot set amount, merchant, contract, nonce, signed envelope or success flag. Unique quote/operation reserves budget atomically, returns 202 `{attemptId,operationId,status}`. Same client key+same quote returns same attempt; key reused for different quote returns 409 IDEMPOTENCY_CONFLICT. Repeated quote with a new key returns existing attempt without a second reservation. This endpoint does not synchronously wait for chain finality.

### API-010 — GET /api/v1/payment-attempts/:id — observe receipt status

Serves F-007, F-008, F-010. Auth: owning session or matching worker run. Return 200 `{attemptId,status,quoteId,veloStatus,innerHash,outerHash,ledger?,receiptId?,errorCode?}` with nullable observed fields. Only an authorized attempt exposes `receiptId`. Reads never resubmit or trigger a new financial operation. Browser has no “mark paid” or raw-proof ingest endpoint.

### API-011 — GET /api/v1/receipts/:id and GET /api/v1/receipts/:id/resource

Serves F-008, F-009, F-010. Auth: owning session or its worker. Metadata route returns receipt/evidence and, only during validity, derived `aegisReceipt` token; no token is persisted in plaintext. Token is HMAC-SHA256 over version, entitlement ID, owner ID, resource key and original valid-until, using fixed canonical encoding. Store/compare SHA-256 token hash; regeneration never extends its lifetime. Resource route checks the same session/resource/window and returns the gated report; it may look up the token server-side. Expired receipt metadata remains visible but content returns 403 ENTITLEMENT_EXPIRED. Never accept user-provided entitlement JSON as authority.

### API-012 — PATCH /api/v1/merchant/resources/:id — change future offers

Serves F-004, F-005, F-010. Merchant-only `{priceStroops:string,enabled?:boolean}`; bounds are positive XLM integers. Return 200 public offer metadata. No wallet/asset/route/body changes via this route. Existing quote snapshots remain unchanged. This supports a changed-price model rehearsal without deploying code.

### API-013 — GET /api/health — minimal liveness

Serves F-012. Auth: none, safe because response is only `{status:'ok',network:'testnet'}` without config or dependency details. Dependency diagnostics are authenticated API-002. No secret-bearing health output.

## Error codes

Envelope: `{error:{code,message,correlationId}}`; safe fixed messages only. Do not return vendor response bodies. Common errors:

| HTTP | Codes | Meaning |
|------|-------|---------|
| 400 / 413 | INVALID_INPUT, BODY_TOO_LARGE | Invalid schema or bounded streamed body exceeded |
| 401 / 403 / 404 | AUTH_INVALID, ORIGIN_DENIED, FORBIDDEN, NOT_FOUND | Authentication, role/ownership or resource isolation |
| 402 | PAYMENT_REQUIRED | Valid quote challenge, no protected data |
| 409 | IDEMPOTENCY_CONFLICT, RUN_ACTIVE, OPERATION_ACTIVE | Conflict without new financial action |
| 410 | QUOTE_EXPIRED | No new spending from stale unsubmitted quote |
| 422 | POLICY_REFUSED, BUDGET_EXCEEDED, CONTRACT_MISMATCH | Deterministic/live guard refusal; no fulfillment |
| 403 | RECEIPT_INVALID, ENTITLEMENT_EXPIRED, RESOURCE_MISMATCH | Receipt does not authorize this read |
| 429 | RATE_LIMITED | Fixed Retry-After and no enqueue |
| 503 | DEPENDENCY_UNAVAILABLE, INTEGRATION_NOT_VERIFIED | Fail closed until prerequisites/gates pass |

Unresolved payment is a 200/202 resource status with `status:'unknown'` and safe `PAYMENT_STATUS_UNKNOWN`, not an HTTP 500 implying it can be purchased again. No MVP `/webhook` route is registered.

## Rate limits

Canonical limits/body sizes/session lifetimes are in [security](security-compliance.md). Bound polling without treating it as an authorization source.

## Versioning

Application contracts are `/api/v1` except explicit demo/session/health routes. The 402 challenge carries its protocol version. Incompatible contract changes update protocol/version and affected QA before code; no generic external developer compatibility promise in MVP.
