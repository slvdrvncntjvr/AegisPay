# One-POST adapter follow-up — 2026-11-10

**Result:** the existing `createGeminiClient` made discovery GET200, then generation POST503, and returned its fixed `MODEL_UNAVAILABLE` error. No tool choice or successful response-parser acceptance was observed. The historical404 cause remains unknown; this probe establishes no concrete model, endpoint or account repair.

This is the separately authorized follow-up for Orca task `task_9a7dc3557c90`, dispatch `ctx_588f5f513dc5`. It does not reopen the historical assignment's exhausted two-POST allowance. Its own one-POST allowance is now exhausted. The [initial report](report.md), original receipts and validation were preserved byte-for-byte.

| UTC observation | Actual request to `https://generativelanguage.googleapis.com` | HTTP | Safe adapter result |
|---|---|---|---|
| 11:25:36.323 | GET `/v1beta/models`, adapter-generated pageSize100 query | 200 | Discovery parsed and allowed generation to proceed |
| 11:25:40.804 | POST `/v1beta/models/gemini-3.5-flash:generateContent` | 503 | `MODEL_UNAVAILABLE` |

The fixed demo input contained only fictional QuickSignal300000 / DeepTrace1200000 offers and budget1000000, with the existing authored demo instruction and canonical `request_quote` declaration. The helper imported only the pure model adapter and its transitive shared schema/Zod dependencies, plus Node built-ins and the existing TypeScript loader. No application executor, trustedTool, DB, offline smoke or test was imported or run. No proposed tool was executed and no financial action occurred.

An observational fetch wrapper checked the official destination and one-POST limit, recorded method/path/status, then delegated the original input and init unchanged to the captured original `globalThis.fetch`. It returned the same Response object without reading or cloning its body. The existing adapter retained header authentication, redirect rejection, request/response caps and30-second per-request timeout, with a35-second overall caller deadline. There were exactly one discovery GET and one generation POST, zero explicit retries and zero redirects. No alternate transport or schema was used to force a pass.

The existing adapter discards non-success bodies before returning its fixed error. Consequently, this follow-up does **not** identify a Google error code/status or underlying503 cause. The earlier native-HTTPS probe independently observed Google `UNAVAILABLE` on its own503 response; that status is not copied onto this new response. This result confirms that503 also occurs with the application adapter's actual fetch path. It neither proves a parser defect nor qualifies successful generation parsing or tool choice.

[The safe receipt](adapter-followup-2026-11-10.json) records the exact observed timestamps, HTTP statuses and fixed adapter code. The model adapter and shared-schema SHA256 fingerprints are identical immediately before and after the check. No source/configuration or canonical document was edited by this worker. No provider text, continuation, thought/signature, raw request, raw vendor error, account data, key or key fingerprint is persisted.

[Validation](adapter-followup-validation-2026-11-10.json) records the known-key artifact scan, structural documentation checks and initial-artifact preservation. Those checks are not application or release acceptance. The [previously verified official sources](primary-sources.json) remain the API contract reference; public documentation review is separate from the actual HTTP observations above.

Keep the current model/configuration and the earlier404 diagnosis unchanged unless new evidence establishes a specific repair. Further generation requires a separate authorization; no further request was made. TASK-007 purchase and TASK-010/012 release acceptance remain open.
