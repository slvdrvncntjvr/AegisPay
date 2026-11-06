# Methods & Traceability — Glass-Box Ledger — {project_name}

<!--
CONDITIONAL doc. Generated ONLY when the product **computes or derives numbers** — scores,
prices, fees, BPS splits, on-chain amounts, risk metrics, projections, rankings. If the product
surfaces no computed numbers, this whole doc is "N/A — because <reason>" and is skipped.
Owner: architect. Depends on: system-design, data-model.
-->

## The glass-box contract (non-negotiable)

Every number the product emits MUST carry — and resolve to:
1. an **`equation_id`** (defined in §2), and
2. its **`input_dataset_ids`** (defined in §3), and
3. a **computed confidence** (per the §1 rubric) — computed, never a guessed label.

**The LLM narrates and cites; it never originates a number.** A number that can't name its
equation + inputs + confidence does not ship — it is flagged, not invented. Low-confidence
outputs render as a **range or direction, never a false-precision point estimate.**

## 1. Confidence rubric (how confidence is computed, not guessed)

| Level | How it renders | Trigger |
|-------|----------------|---------|
| **High** | point value + tight range | all inputs are High-tier and the method is validated |
| **Medium** | value + explicit range | some inputs Medium-tier, or method partially validated |
| **Low** | **directional only** (range/arrow, no point estimate) | any input Low-tier, or the method is unvalidated |

State the rule that maps input tiers → output confidence. No number inherits a confidence higher
than its weakest load-bearing input.

## 2. Equation registry

Every computed output gets a stable `EQ-###`. Never renumber; retire and add.

| `EQ-###` | Output (what it produces) | Formula / method | Input dataset IDs | Confidence | Reference |
|----------|---------------------------|------------------|-------------------|------------|-----------|
| EQ-001 | {e.g. milestone payout amount} | {formula} | DS-001, DS-002 | {H/M/L} | {source or "internal rule"} |
| EQ-002 | {…} | {…} | {…} | {…} | {…} |

## 3. Dataset / input registry

Every input a number depends on gets a stable `DS-###`.

| `DS-###` | Input / dataset | Source | Access & license | Confidence tier |
|----------|-----------------|--------|------------------|-----------------|
| DS-001 | {…} | {…} | {…} | {H/M/L} |
| DS-002 | {…} | {…} | {…} | {…} |

## 4. Traceability (numbers ⇄ features ⇄ tests)

- Every `F-###` (PRD) that **displays a number** names the `EQ-###` that produces it.
- The QA plan ([qa-test-plan.md](qa-test-plan.md)) tests that each displayed number matches
  its equation output and carries its confidence label.
- Any number in the docs or UI without an `EQ-###` is a glass-box violation — fix or flag
  `[assumption]`.
