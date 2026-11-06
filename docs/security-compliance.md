# Security and threat model

**Scope:** private Testnet hackathon demo. Implement the controls below; no independent audit, production custody or compliance certification is claimed.

## Data classification

See [data model](data-model.md) for field-level classification, secret exclusions and retention. The most sensitive values are the agent signing key, Velo/model credentials, envelope encryption key, login secrets, session tokens and receipt-signing key. Chain data is public but linking it to prompts is private.

## Authn / authz model

Use private demo authentication, not a full account service. Two independently generated high-entropy login secrets map to configured owner and merchant identities. POST-only login compares fixed-length hashed inputs using constant-time comparison; never include login secrets in bundles, URLs or logs. Create random 32-byte opaque session tokens, store only SHA-256 hashes in DB, and set `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` for HTTPS. Loopback HTTP development alone may omit Secure. Session lifetime is 8 hours; logout revokes the DB row.

Wallet connection is not login. The connected/signing wallet must match the role's configured address; returned transaction signatures and prepared body are verified server-side. Worker tokens are random, DB-hashed, scoped to owner+run, valid for at most 15 minutes and rotated for a waiting run; they cannot call owner, merchant or session-management routes. Web and worker query the same session ownership facts.

All API surfaces are explicitly classified in [API spec](api-spec.md). Only login and minimal health are public; login has no application read/write authority until authenticated. GET catalog/demo routes still require session. Merchant has no owner task access or ungated fixture preview. No unauthenticated sponsorship, quote acceptance, claim or proof-ingest endpoint exists.

**Bounds:** login max 5 attempts per 15 minutes per IP-hash and role, plus a global max 50 per minute; authenticated writes max 30 per minute per actor; run starts max 3 per minute per owner plus the active-run lock; polling max 60 per minute per session. Use DB-backed counters with expiry for login/write limits; respond 429 with Retry-After. Do not trust spoofable forwarding headers unless a configured host proxy supplies them. Global limits may reduce availability under attack; this private demo is not a public auth service.

**Bodies:** ordinary JSON max 16 KiB, wallet submit max 256 KiB, task text max 2000 characters, tool schemas strict and bounded, fixture body max 64 KiB. Enforce limits while streaming, not only through Content-Length. Mutating browser requests require exact configured Origin and same-site cookies; reject missing/untrusted Origin except scoped worker bearer calls. No wildcard CORS. Protected data, quote and receipt responses are `no-store` and never included in server-rendered public HTML.

## Threat model

| T-ID | Threat (STRIDE) | Vector | Impact | Mitigation | Enforces |
|------|-----------------|--------|--------|------------|----------|
| T-001 | Tampering | Edit price/resource after acceptance | Pay for different terms | Immutable DB snapshot, trigger and pre-sign intent hash | INV-001 |
| T-002 | Spoofing | Fake event, wrong contract or failed transaction | Free report | Independent RPC envelope/result/event verification and explicit deployment config | INV-002 |
| T-003 | Tampering / race | Present proof in many simultaneous requests | Multiple entitlements | Unique quote/inner hash/event/evidence, locked atomic grant | INV-003 |
| T-004 | Spoofing | Only Velo or only RPC says success | Premature fulfillment | Require both consistent observations; mismatches → manual review | INV-004 |
| T-005 | Repudiation | Timeout rendered as failure then paid again | Double payment/data leak | Durable unknown state, preserve reservation, observation-only recovery | INV-005, INV-010 |
| T-006 | Information disclosure | Stolen receipt, foreign owner or different resource | Cross-user content leak | Session+owner+quote+fixture+resource+window checks; receipt hash; no-store | INV-006 |
| T-007 | Elevation | Prompt/report injects price, URL or policy edits | Unbounded spending/SSRF | Narrow ID-only tools, sequential guard, trusted catalog, task reservation, no wallet tools | INV-007 |
| T-008 | Elevation | Local-only policy check or malicious agent | Above-cap/expired payment | Finite nonzero contract policy and live rejection evidence; contract rechecks at execution | INV-008 |
| T-009 | Spoofing | Checkout webhook or claim label fakes payment | False settlement claim | No webhook routes, separate claim entity and copy | INV-009 |
| T-010 | Repudiation / crash | Restart between handoff and response | Second XDR submission | Saved reservation before handoff, durable dispatch marker, no auto-resubmit | INV-010 |
| T-011 | Information disclosure | Client import, log/error or model context contains secret | Agent/relayer compromise | Process-separated secrets, allowlisted structured logs, bundle/log scanning | INV-007 |
| T-012 | DoS | Unbounded runs, quotes or signed bodies | Quota/cost exhaustion | Body limits, finite loop, throttles, single active run/attempt | INV-007, INV-010 |
| T-013 | Tampering | Replay wallet operation or wrong signed body | Unauthorized setup/funding/claim | Bind session/source/body/network and expiry; per-source lock; durable tx hash observation | INV-001, INV-010 |
| T-014 | Information disclosure | Fixture in client JS, RSC payload, error, catalog or preview | Paid report leaks | Worker/server-only imports, guarded API, response/bundle sentinel tests | INV-005, INV-006 |

## Abuse & safety-specific risks (ethical)

| Risk | Who is harmed | Trigger | Guard |
|------|---------------|---------|-------|
| Repeated capped spending drains escrow | Owner | Compromised agent key | Finite escrow + expiry, task budget/serialization, revoke/disable; per-payment cap is not a daily budget (INV-007/INV-008) |
| Misleading vulnerability report | Demo viewer | Fictional feed interpreted as intelligence | `isDemo` everywhere; sample dependency/report; no real security advice |
| False payment confidence | Merchant/owner | Unknown or pending status described as paid | Evidence gate and honest state/copy (INV-004/INV-005/INV-009) |

## Compliance obligations

This scope moves Testnet assets and uses fictional reports. No legal determination about future payments, custody, financial regulation or privacy compliance is made. A production/mainnet/customer-data expansion requires a separate legal/security scope decision and key-management work. Do not display a compliance badge or promise audited safety.

## Secrets handling

Use untracked server environment files and host secret configuration; `.env.example` contains no actual credentials. Agent/Velo/model/encryption credentials belong only to worker environment. Locally, `.env.local` is web-only, `.env.worker.local` contains worker and shared configuration, and optional `.env.spike.local` is solely for disposable integration-harness keys. Next automatically loads `.env.local`, so never place worker secrets there and assume module separation hides them from that process. Web and worker share DB access and a separate receipt-signing key where necessary; no `NEXT_PUBLIC_` secrets. Human wallet seeds remain in Freighter. For setup-only live scripts the owner/merchant sign externally or use explicit disposable Testnet test-harness keys; no secret input via CLI flags or source files.

Signed agent envelope is sensitive, encrypted before sponsorship with operation ID as authenticated context, never logged and wiped at handoff/terminal pre-handoff failure. Ciphertext is not exposed through API. Inspect only its fingerprint in audit. Encryption-key loss halts pre-handoff recovery; it does not justify signing a new operation. Rotate a compromised agent by revoke, safe reclaim and fresh provision; retain historical address/operation evidence.

## Audit & logging

Structured allowlist: correlation, run/quote/operation IDs, safe fixed state/error code, verified contract IDs, ledger/event IDs, inner/outer hash, decimal amounts/observed fees, durations and configuration version. Do not serialize whole requests, vendor errors, SDK objects, XDR, credentials or arbitrary tool payload. Show concise model-stated choice reason; do not request or expose private chain-of-thought. Protect task text in authenticated storage and cap its retention. Redaction applies to browser traces and exported evidence as well as logs.

## Incident response basics

Disable new run/payment intent, pause Velo sponsorship if appropriate, revoke the Noir agent using owner wallet and verify ledger confirmation. Recover remaining escrow in the safe contract order. Preserve unresolved attempts and observe them; cancellation of UI/worker wait is not chain cancellation. Rotate affected environment credentials, remove leaked artifacts and document the incident. Never clear DB rows or reset a nonce to pretend an unknown charge did not occur.

## Pre-milestone hard-gate checklist

These are execution gates, currently pending rather than claimed complete:

- [ ] Auth/ownership/body/origin tests pass on every exposed route — TC-020/TC-024.
- [ ] Secrets and fixture bodies absent from unauthorized output, bundles and traces — TC-015/TC-028.
- [ ] All invariant negative cases pass — QA matrix.
- [ ] Live Velo/Noir success, policy refusal and merchant claim have reproducible evidence — TC-001/TC-002/TC-016.
- [ ] Contracts/network/SAC and SDK versions match the saved live proof — TC-013.
- [ ] Unknown/crash/replay recovery passes with no second financial handoff — TC-007/TC-012/TC-029.
- [ ] Ledger, PRD, architecture and task status are reconciled before the demo.
