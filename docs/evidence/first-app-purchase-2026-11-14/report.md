# First actual model-driven app purchase and report delivery

Run `8b0bd3bc-6276-40df-bfe3-3fbb2b9e5d20` completed2026-11-14T15:42:59.260Z through the real Gemini adapter and durable application worker. Five model turns and four trusted tool steps discover the catalog, request the QuickSignal quote, accept its purchase and read the entitled fictional report. The initial unrelated failed model run remains preserved.

The user's screenshot captured an intermediate unknown outcome. The worker subsequently resolved the same saved reservation/attempt by observation. Repeated payment-observed events are status reads, not separate charges. Exactly one application payment attempt exists, nonce1,300000stroops spent,0reserved. No second purchase, nonce reset or replacement handoff was used.

## Independent verification of the saved identity

`node --import tsx deployment/finals/local-release/verify-first-purchase.mjs --verify-saved-purchase` passed,exit0. [Actual verification receipt](verification.json) records:

| Field | Verified value |
|---|---|
| Quote |9be17111-16aa-4d75-9c8f-98cee5aa3e2e|
| Attempt |baeaf3b8-a857-4f75-a0c7-332889c0777a|
| Operation |522f6059-6604-49f4-ba5f-31523a6cce90|
| Velo reservation |c2884bf4-a363-4166-9e9d-5d73390a7392|
| Inner Noir hash |b2eee1f4e835a5bd2409cb3189c2a0980cef29555e2e0ce2f9896cbba1e581dd|
| Outer and mapped event hash |01067cca03fa5de9c03bdc401b999fa4b241c3677721ce98a57f66848ad304a2|
| Ledger / event |5729440 /0024607757424463872-0000000000|
| Nonce / amount |1 /300000stroops (0.03TestnetXLM)|
| Actual charged fee |85639stroops, matching outer ledger and Velo|
| Current escrow / merchant pending |700000 /300000stroops|

The verifier reads only the exact saved current purchase. It independently invokes Velo getStatus and the shared signer-free authorization verifier, which requires successful RPC transaction, exact envelope/invocation/asset/agent/device/merchant/amount/nonce and embedded matching Noir event, fee and inner/outer mapping. No signing/preparation/sponsorship/submission function is called. No secret agent input is read. The unrelated historical Nov9 unknown payment remains untouched.

## Entitlement and delivery

Receipt `07e80131-f11c-483e-b911-edbbab5b25ff` already had first-delivery time15:42:43.694Z from the actual model run before coordinator verification. Its fixed original access window ends15:56:59.885Z. Actual authenticated receipt metadata and report reads return200; anonymous report returns401. The verifier leaves one attempt and one entitlement and revokes its test session. No receipt token, private provider content, final answer or protected report body is saved in public evidence. The receipt can be recovered without repurchasing; its window is not extended by refresh.

This completes TASK-031's first actual app purchase/delivery scope. Existing application unit/integration/browser gates remain prior evidence; no application source changed in this read-only verification checkpoint. Documentation/strict task checks and helper syntax are checked separately. This receipt is one genuine application success, not two copies counted as two successes; the earlier compatibility spike is separate historical evidence.

## Next manual step and remaining release work

Hard-refresh the owner page to see completed, then use Audit to view receipt metadata and the entitled demo report before its access window closes. Log out and log in with the Merchant role/token from the protected local access file. Select the distinct merchant Freighter account ending XCHK on Testnet, refresh merchant pending (0.03XLM), prepare Claim merchant pending, review/sign once, then check its saved wallet status. This claim is a separate human-controlled transaction; payment authorization credited merchant-pending escrow rather than directly paying the external merchant wallet.

Do not fund again: initial lifetime funding authority is already consumed. Current owner policy expires23:48:20Manila; a later task needs a valid finite policy. A second distinct application purchase, actual changed-price/no-purchase/refusal/recovery, merchant claim, revoke/reclaim and full hosted/media gates remain open. No complete live MVP acceptance or old-incident resolution is claimed.
