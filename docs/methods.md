# Methods and numeric provenance

## The glass-box contract

Only deterministic code originates financial amounts and measurements. Every computed financial/measurement output has `{value,equationId,inputDatasetIds,confidence,observedAt}` or an explicit unavailable result. JSON values for money are integer strings; rendered XLM is an exact decimal string. Model prose may cite those values, never invent amounts, fees or risk scores. Operational defaults and UI IDs are configuration, not measured outcomes.

## 1. Confidence rubric

`confidence = min(methodValidated ? 2 : 0, ...inputTiers)` with high=2, medium=1, low=0. Method validation means its referenced QA case passed on the current code. Before those tests pass, methods remain unvalidated. Validated exact conversions with validated configured inputs may render as exact demo configuration; observed balances also need successful matching chain reads. Stale cached data is at most medium and labeled with observation time; unknown/missing chain data is unavailable, not an estimated point value. Low-confidence economic forecasts and financial estimates are omitted. Measurement confidence describes this sample, never a production prediction.

## 2. Equation registry

| ID | Output | Formula / method | Input dataset IDs | Confidence | Reference |
|----|--------|------------------|-------------------|------------|-----------|
| EQ-001 | XLM ↔ stroops | Parse positive decimal string with at most 7 fractional digits; multiply integer whole part by 10000000 and add right-padded fraction. Reverse uses integer quotient/remainder; reject excess precision and overflow | DS-001 | Rubric minimum; exact once TC-018 passes | XLM precision in IDEA.md §6.4 |
| EQ-002 | Task remaining | `budget - spent - reserved`, under the run row lock; reject a purchase unless remaining ≥ quote amount | DS-001, DS-002 | Minimum input/method tier; TC-023 | PRD BR-003 |
| EQ-003 | Escrow / pending / cap display | Identity of successful verified chain read in stroops, then EQ-001 formatting; no locally predicted balance is labeled confirmed | DS-003 | High only with matched live read + TC-001/TC-022 | Contract observations |
| EQ-004 | Actual chain fee | Identity of validated outer transaction charged fee; compare to Velo actual fee when present. Sponsored fee paid by relayer is separate from escrow amount; never add fee to payer spend automatically | DS-003, DS-004 | Unavailable on conflict/null; validated by TC-027 | Chain transaction metadata |
| EQ-005 | Purchase latency | `entitlementVerifiedMonotonicTime - acceptedMonotonicTime` for same-process sample; persisted wall-clock timestamps only as labeled diagnostic after restart | DS-005 | High for validated clock sample; unavailable for cross-process monotonic mismatch; TC-027 | Measurement definition |
| EQ-006 | Sample p50 / p95 | Sort eligible complete durations; nearest-rank index `ceil(p*n)-1`, p=.50/.95. Show sample size and environment. Omit percentiles if fewer than 20 complete samples | DS-005 | Minimum tier; no population confidence claim; TC-027 | Internal measurement rule |
| EQ-007 | Sample failure fraction | `definitive failed attempts / all accepted attempts` with pending/unknown reported separately and never counted as success; show numerator/denominator | DS-002, DS-005 | Minimum tier; TC-027 | Internal measurement rule |
| EQ-008 | Authorization delta | Isolated pre-claim escrow decrease and pending increase must each equal quote amount. If concurrent claim/other payment exists, use transaction evidence rather than ambiguous aggregate difference | DS-001, DS-003 | High only for isolated matched snapshots; TC-001/TC-016 | Spike consistency check |

## 3. Dataset / input registry

| ID | Input | Source / access | Confidence tier |
|----|-------|-----------------|-----------------|
| DS-001 | Demo prices, configured finite policy/task ceiling, immutable quote | Owner-controlled fixtures and accepted quote; demo content is self-authored, not live security intelligence | High for valid exact config; not evidence of market value |
| DS-002 | Run reservations, spend and attempt outcomes | PostgreSQL domain transactions; private operator access | High only after constraint/integration gates; unknown otherwise |
| DS-003 | Contract reads, successful envelope/result/event and charged fee | Configured Stellar Testnet RPC plus saved proof; public-chain inputs | High after network/hash/contract/field match; unavailable when not observed |
| DS-004 | Velo reservation and status DTO | Scoped operator API access; SDK-validated response | Medium alone; jointly matched chain data supports high, null remains unknown |
| DS-005 | Recorded monotonic measurements and terminal outcomes | Redacted local benchmark samples with run/attempt IDs | High for validated local samples; no production generalization |

## 4. Traceability (numbers ⇄ features ⇄ tests)

F-002/F-003/F-004 use EQ-001/EQ-003; F-005/F-006 use EQ-001/EQ-002; F-007/F-010 use EQ-004/EQ-005 and optional EQ-006/EQ-007; F-008/F-011 use EQ-003/EQ-008. [QA](qa-test-plan.md) owns TC-001, TC-016, TC-018, TC-023 and TC-027. No USD conversion, fee estimate, confidence-based vulnerability score, savings percentage, positive-margin claim or derived market size ships in the MVP.
