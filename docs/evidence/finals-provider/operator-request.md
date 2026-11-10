# Prepared Velo operator request — not sent

Prepared 2026-11-10 for coordinator review. Contains only safe operation identifiers/status facts. It is not authorization to sign, reserve, submit, cancel, refund, reset, reconcile through a mutation or contact anyone externally.

**Subject:** Read-only retained-execution lookup for unresolved Testnet Gas reservation

Please locate only the project-scoped reservation below, using the project associated with the existing authorized Gas key. Confirm the exact project ID from your authenticated project context; historical project IDs elsewhere in AegisPay documentation are not independently reverified here.

| Safe lookup field | Value |
|---|---|
| Service | Velo Gas Station, Stellar Testnet, `https://www.velo-build.dev` |
| Request ID | `3ef113f6-0bb4-449a-ac6a-29407adb4ee5` |
| Inner transaction hash | `36f71d7ddee16271b6c23e73fa5ef1f1ca4f0e44e3d0a52ef6eca2115f80d0f8` |
| Caller operation ID | `3ced1846-a7cd-4455-bb27-0b21a253f2c3` |
| Application attempt | `f69178b7-0b0b-46fa-8e82-65c2dd5deee5` |
| Persisted caller handoff UTC | `2026-11-09T09:36:16.026075Z` |
| Saved last validated provider state | `claimed`; outer hash unknown |
| Later bounded status observations | HTTP409 at `2026-11-09T09:43:53.977Z` and `2026-11-10T05:33:43.391Z` |
| Latest single authorized status detail | HTTP409 / `reservation_expired` at `2026-11-10T06:00:30.015Z`; safe correlation ID `4db7ad55-5519-4e79-9442-a366474099cd` (error metadata, not a replacement reservation) |
| Independent saved inner RPC observation | `NOT_FOUND`; does not establish terminal failure |
| Application financial state | 300000 stroops reserved; spent0; zero entitlements; original identity retained |
| SDK | `@carts1024/velo-sdk` exactly1.0.0; identity-only status body has request ID and inner hash |

Requested **read-only response**, using individually selected safe fields:

1. Read the existing project's Gas Activity execution detail for this exact request. Official public source exposes `api.gas.queries.getExecutionDetail({ projectId, requestId })`, guarded by project read membership, returning a sanitized DTO. Confirm whether that query/view is deployed and available. A null/not-found detail must remain an unavailable observation, not a failure ruling.
2. Return the matching request ID/inner hash, current provider execution lifecycle, nullable outer hash, exact actual fee (nullable when unknown), reconciliation-required flag, relevant UTC observation/transition timestamps and ledger identity if verified. Do not return signed input, custody data, API keys, session tokens, raw provider exceptions or entire records.
3. Identify the stable error `code` and safe correlation/request ID for the two409 observations if retained. Clarify whether the server means `reservation_expired`, `invalid_lifecycle` or another deployed error, and provide the deployed version/commit or response-schema revision. Public main `c63b3308ad69d2c5a919f94052571a38a2188121` is an inspected source reference, not an asserted server version.
4. If it executed, provide the **outer fee-bump transaction hash separately from the inner hash**, terminal execution status, ledger/time and exact fee with independent ledger-verifiable references. AegisPay backend must still verify the matching Noir envelope/invocation/event before fulfillment.
5. If the provider believes it never sent, provide the retained send-count/authorized-send-boundary facts and durable fencing/terminal transition evidence for this request, including whether any provider job can still dispatch it. A reservation-expiry message or assertion without verifiable terminal provenance must not automatically release the application budget. Preserve the existing record; no cancellation or mutation is requested by this packet.
6. If unresolved, identify the missing observation/operator prerequisite and return the safe current state. Preserve the original identity and evidence; no fresh XDR/signature/sponsorship/submission or replacement purchase is requested.

The project console's pure read differs from the SDK's no-XDR status route: inspected source may update unsent-expiry bookkeeping on status access, and internal operator reconciliation actions mutate records. Those actions are outside this read-only request. No key material, full signed envelope or wholesale account export is necessary to locate this known request.

## Later coordinator evidence update

The [single original-identity status artifact](../finals-payment/actual-single-status-detail-1794290430016.json) supplies the stable error code above. This narrows the earlier HTTP409 uncertainty to the deployed response `reservation_expired`; it does not establish the deployed source version, retained send count, terminal fencing, or definitive nonexecution. Items 1, 2, 4 and 5 remain necessary as applicable. No additional polling, external contact or provider mutation was performed for this packet update; this request remains unsent.
