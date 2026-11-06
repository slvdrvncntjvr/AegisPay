# AegisPay — Policy-Controlled Agent Payments for Paid APIs

> **Status:** Conditional GO — hackathon MVP candidate, not a validated production business.  
> **Version:** 1.0 / architecture decision draft  
> **Research cutoff:** 2026-11-06 (Asia/Manila)  
> **Target:** Velo × Noir Agentic Payment Hackathon, Stellar Testnet  
> **Project type:** Developer infrastructure + demonstrable autonomous purchasing agent  
> **Implementation rule:** This document is the product specification. Where an API detail is tagged **SPIKE / VERIFY**, do not let a coding agent invent the integration; establish it against the pinned SDK first.

---

## 0. Executive decision

**Build AegisPay, but reduce the claim.** The original concept described a comprehensive, production-ready, zero-trust, x402-compliant enterprise gateway. That is not yet supported by primary technical documentation or customer interviews. The viable hackathon wedge is narrower:

> **AegisPay lets a developer-owned AI agent discover a paid API, decide whether the result is worth buying, and authorize a bounded Stellar Testnet payment through Noir escrow. Velo sponsors and submits the eligible signed Soroban transaction; the resource server grants access only after confirming the correct on-chain Noir authorization.**

**One-line pitch:** *APIs that agents can buy from, with spending rules their prompts cannot override.*

**Hero demo:** A security-research agent investigates a software dependency. It discovers two paid intelligence endpoints, selects the one that fits its task and spend budget, handles an HTTP 402 challenge, authorizes one XLM Testnet payment, waits for ledger evidence, receives the purchased report, and explains its result. A second, overpriced offer is rejected by Noir's on-chain per-payment cap.

**What the MVP proves:** Real agent-initiated authorization, real escrow state changes, integration of both named SDKs, and fail-closed delivery. It does **not** prove profitable commercial micropayments, full x402 v2 interoperability, bank on-ramps, audited smart-contract security, generalized production merchant support, or demand among mid-market enterprises.

**Critical acceptance dependency:** Before building the UI, complete the Velo Gas Station + Noir authorization compatibility spike in §12. The proposed combined transaction submission has not been independently run as part of this document.

### Confidence ratings

| Dimension | Decision | Basis / limitation |
|---|---|---|
| Problem plausibility | **Medium-high** | HTTP micropayment and agent-spending security concerns are real; demand for *this product* remains unproven. |
| Technical possibility | **Medium** | Noir contract/SDK methods exist; Velo Gas Station exists; composed integration requires a live spike. |
| Hackathon relevance | **High, conditional** | An agent autonomously triggers Noir payments and Velo SDK operations. Confirm whether organizers require *Velo Pay specifically* rather than Gas Station. |
| MVP demo feasibility | **Medium-high after spike** | Constrain to one agent, two simulated merchant endpoints, one token, one protected report, no fiat settlement. |
| Commercial viability | **Unvalidated** | No real interviews, willingness-to-pay test, on-chain fee benchmark, or repeat-volume evidence supplied. |
| Production/security readiness | **Low** | Alpha Testnet dependencies, untested integration, application-layer entitlement binding, key management, custody and abuse questions. |

### Kill / pivot criteria

1. **SDK gate:** If no reliable path exists for Velo Gas Station to sponsor and submit a signed Noir `payment_escrow.authorize` invocation with successful ledger evidence, do not imply that Velo provides Noir settlement. Re-scope to a separately documented Velo Pay workflow and seek clarification on hackathon acceptance; do not bolt on a cosmetic integration.
2. **Contract gate:** If the organizer-provided contracts are not the deployment accessible through the selected Noir SDK, configure the client explicitly or pin a version whose contract map matches. Never silently use stale contract IDs.
3. **Economics gate:** If effective per-call fee + sponsorship + operating costs exceed the value of a typical call, present it as a secure Testnet demonstration, not a proven sub-cent business model.
4. **Validation gate:** If interviews show developers prefer prepaid API keys or centralized budgets and have no appetite for on-chain settlement, reposition as a specialized developer experiment rather than a general monetization platform.

---

## 1. Source of truth, fact-checking, and corrections to the original blueprint

### 1.1 Validated facts

- A peer-reviewed-status-**not-assumed** May 29, 2026 preprint describes synchronization, context-binding, and concurrency flaws in some x402 implementations. This supports a **threat model**, not the claim that every x402 deployment is vulnerable. [S1]
- Noir's published `@noirx402/agent-sdk` documents `NoirAgentClient`, `checkPayment`, `authorizePayment`, `execute(... registerDevice/registerAgent/fundEscrow ...)`, `claim`, `watch`, and an optional signed webhook relay. It documents a per-payment cap, asset and expiration policy, and escrow locking. [S2]
- Noir `agent_registry.max_amount` is a **per-authorization** cap. An escrow balance bounds available prepaid funds; neither mechanism by itself implements daily budget, merchant allowlisting or cumulative spend across refills. A value of `0` for `max_amount` means uncapped in the referenced contract README: **never use zero as an MVP spending cap**. [S2, S3]
- Noir `authorize` accepts agent, device hash, merchant, asset, amount, and nonce; it does **not** accept a resource URL, request hash, quote ID, or service SKU. A transaction is therefore **not cryptographically bound on-chain to a particular API resource** using the documented contract interface. [S3]
- `authorize` deducts escrow and credits **pending merchant balance**; `claim` later transfers merchant funds. These are distinct stages. Calling the first stage *merchant cash settlement* would be misleading. [S3]
- Velo's `@carts1024/velo-sdk` documents hosted checkout/payment-intent APIs and signed webhooks for Velo's own supported workflows. A `payment.succeeded` Velo Pay webhook is **not automatically evidence** that Noir's `payment_escrow.authorize` ran. [S4]
- Velo also documents Gas Station with `gas.sponsorAndSubmit(signedTransactionXdr, ...)`, `gas.getStatus(...)`, and `gas.waitForResult(...)` for eligible user-signed **Testnet Soroban** transactions. This is the proposed SDK bridge, but contract-allowlist and transaction-assembly compatibility must be tested. [S5]
- Velo states its platform is still an alpha/Testnet offering; its hosted checkout end-to-end qualification is in progress, and live fiat settlement is not offered. [S4, S5]
- HTTP 402 and `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` exist in x402 v2, but using those headers with a proprietary Noir proof schema does **not** by itself make AegisPay x402 v2 compatible. [S6]
- Soroban temporary storage expires irrecoverably; persistent and instance data can be archived/restored. Storage TTL and chain fees vary with ledger resources: do not quote one transaction fee as a general average. [S7]

### 1.2 Corrections and rejected unsupported claims

| Original assertion | Disposition | Corrected framing |
|---|---|---|
| “Validated demand; interviews consistently highlight pain.” | **Not evidenced** | Interview plan exists; **no completed interviews were supplied**. |
| “Mid-market APIs lose $60k–$90k; 85–92% waste; ROI $340k–$520k.” | **Unsubstantiated** | Exclude until an attributed, inspectable study or actual customer data supports each figure. |
| “Velo payment.succeeded verifies Noir escrow authorization.” | **Incorrect assumption** | Reconcile Noir authorization against the exact Stellar contract and transaction; use Velo Gas Station status for sponsored execution. Keep Velo Pay webhooks scoped to Velo Pay. |
| “Signature is bound to the requested URL/resource.” | **Incorrect at contract layer** | Noir binds documented payment parameters; use application-owned quote-to-operation mapping and single-use entitlements, and disclose its limits. |
| “Noir prevents infinite spending.” | **Overclaim** | Noir enforces a per-payment cap and finite escrow; a compromised agent can still make repeated capped payments until escrow is drained. |
| “Fund Velo checkout → user's Noir escrow is funded.” | **Unsupported link** | Velo checkout sends a supported payment to its configured receiver; Noir `fundEscrow` remains a separate owner-authorized on-chain action unless an explicit bridge is engineered. |
| “Instant, no fees / under 2-second payment for every API call.” | **Unverified/generalized** | Measure end-to-end Testnet confirmation and full economic cost; display actual duration and fee in demo. |
| “x402 compliant.” | **Unproven** | **HTTP 402-inspired proprietary adapter** initially; full x402 v2 scheme integration is a future task. |
| “Production-ready, secure standard.” | **Overclaim** | Hackathon MVP on alpha Testnet, no independent audit. |
| “Gartner $234B SaaS disruption proves this market.” | **Category-level, not product demand** | Gartner's July 2026 analysis supports a broad shift in enterprise software economics; it does not validate adoption of AegisPay. [S8] |
| “6.4M payments, 90.8% below $0.01 proves buyers.” | **Overinterpretation** | The cited 35-day sample shows transaction distribution, not independent customers or willingness to pay; activity was concentrated. [S9] |

### 1.3 Competitive reality

Alternatives include conventional prepaid API keys + billing, centralized usage meters and quotas, generic AI cost governance, hosted payment services, x402 middleware/facilitators, and wallet policy tooling. AegisPay **must not** claim it invented pay-per-call APIs, HTTP 402, or constrained agent payments. Its proposed differentiator is **a developer-oriented, application-reconciled integration of Noir escrow policy and Velo-sponsored Testnet execution, with observable proof of paid resource fulfillment**. That is a combination/workflow differentiation, not a defensible protocol moat yet.

### 1.4 Named alternatives (as of November 2026)

| Alternative | What it already solves | Implication for AegisPay |
|---|---|---|
| **Prepaid API keys / existing API billing** | Well-understood access control, quotas and centralized usage metering without chain fees. | This is the default to beat. Must show a real reason an agent needs wallet-native per-request purchasing instead. |
| **Coinbase / x402 ecosystem** | HTTP 402-based paid content/API access with facilitators and wallet-payment integration. | Never claim that HTTP 402 or autonomous API purchase is original. Compete on **Noir + Stellar policy + auditable entitlement reconciliation**, if users value that. |
| **Cloudflare Monetization Gateway** | x402 v2 rules for APIs, MCP tools and datasets, with origin validation and settlement through a facilitator; currently described as closed beta with U.S.-based buyers/sellers. | Strong infrastructure incumbent; makes a generic cross-chain “gateway for everyone” a weak business position. |
| **Circle Agent Stack / Agent Wallets** | Agent wallets and human-defined spending policy with global limits, per-service caps and time-bounded sessions. | On-chain agent spending limits are **not novel**. Noir's current single-per-transaction cap is less expressive than some competing wallet offerings. |
| **Noir itself** | Device-linked agent policy, escrow authorization and merchant claims. | AegisPay must deliver merchant HTTP gating, resource-specific entitlements, payment reconciliation and agent UX rather than repackage Noir as its invention. |
| **Velo itself** | Checkout/payment events and Testnet Gas Station operational tooling. | AegisPay is an application/integration workflow, not an alternative to Velo's core payment infrastructure. |

**Competitive conclusion:** The long-term differentiated opportunity, if any, is a **secure developer workflow for Stellar-based agent purchasing** plus excellent implementation ergonomics. The SDKs, 402 concept and policy primitives are third-party infrastructure, not proprietary AegisPay inventions. It is also false that agents categorically cannot hold wallets: specialized agent wallets already exist. The actual problem is interoperability, bounded delegation, developer ergonomics and reliable fulfillment.

Additional sources: [Coinbase x402](https://www.coinbase.com/developer-platform/discover/launches/x402), [Cloudflare Monetization Gateway](https://developers.cloudflare.com/monetization-gateway/), [Circle Agent Stack](https://www.circle.com/agent-stack).

---

## 2. Product definition

### 2.1 Who it serves

**Primary MVP user — payer developer:** An independent AI-agent developer or small engineering team that wants its agent to purchase access to external API data under an externally enforced cap. They are technical enough to fund a Testnet wallet and add an SDK adapter; they will judge reliability and control, not visual novelty.

**Secondary MVP user — API owner:** A developer exposing expensive or valuable data enrichment behind a per-call price who wants to avoid making a dashboard account, prepaid subscription, and custom metering system for every test consumer.

**Initially excluded:** CFOs of Fortune 500 organizations, international B2C travel purchases, retail fulfillment, remittances, financial advice, actual fiat conversion, cross-border payouts, mainnet, and non-technical consumers.

### 2.2 Jobs to be done

- **Payer:** “When my agent discovers an API it needs, let it buy a request within the budget I approved, without asking me to approve every individual action.”
- **Payer:** “When the agent attempts an excessive, expired, or unauthorized payment, reject it outside the model's prompt.”
- **Payee:** “When an AI client asks for a paid resource, issue a price and grant exactly the paid entitlement after ledger-confirmed authorization.”
- **Operator:** “When a submission times out or retries, distinguish unknown status from failure, reconcile to one ledger event, and never deliver twice due to a race.”

### 2.3 Promise and boundaries

**Promise:** Agent-controlled intent, developer-controlled risk boundaries, merchant-controlled fulfillment, verifiable on-chain payment authorization.

**Non-promises:** Unhackable AI, regulation-free payments, complete cryptographic binding to resource, guaranteed finality under every RPC condition, fixed low transaction fees, secretless agent operation, zero latency, or a complete Velo↔Noir native integration.

---

## 3. Problem, hypotheses, and validation plan

### 3.1 Problem statement

**Targeted statement:** Small AI-agent teams and specialized API owners lack an easy, auditable pattern for allowing agents to autonomously pay per API request while keeping spending authorization separate from the agent's model and ensuring the merchant only fulfills after a valid on-chain escrow authorization.

This is a **hypothesis**, not a proven customer complaint.

### 3.2 Core hypotheses

| ID | Hypothesis | What would validate it | What would invalidate it |
|---|---|---|---|
| H1 | Some agents genuinely need to buy API data on demand. | Three or more developers describe real past workflows where access was blocked by billing/account setup. | Everyone uses existing subscriptions/API keys without material friction. |
| H2 | Developers prefer on-chain bounded escrow in at least one workflow. | Two design partners accept the complexity to test it. | Wallet, fees and token risk outweigh the budget-control benefit. |
| H3 | API operators want per-request settlement proof. | Two providers commit a non-trivial endpoint or sample feed to a pilot. | They prefer prepaid credits or consolidated invoicing only. |
| H4 | Velo-sponsored Noir authorization is technically workable. | Reproducible live Testnet success and status recovery. | Signed XDR / allowlist / sponsorship API cannot compose under official constraints. |
| H5 | Small per-call charges can make economic sense. | Measured fee and operating cost stay below realistic provider margin. | Chain/network/relay costs consume revenue at target request size. |

### 3.3 Interviews — follow the Mom Test

**Sample:** Six payer-side developers and six provider-side API owners in two rounds. No convenience-only survey of friends who are merely curious about blockchain. Maintain a source/date/role log and avoid collecting unnecessary personal data.

**Ask payer developers about past behavior:** “Walk me through your most recent agent workflow that needed a third-party API”; “Where did setup or payment block the run?”; “Which real run exceeded an expected API cost?”; “What exact limit or guardrail did you implement?”; “What would you refuse to hand to an unattended agent?”

**Ask API providers:** “Show me the last new API consumer you onboarded”; “How are request limits, payment state, and failed requests reconciled?”; “What happens when a user wants exactly one API call?”; “How do you defend against proof replay and retries?”; “What was the last invoice/refund/revenue-leak incident?”

**Evidence hierarchy:** observed behavior or telemetry > paid pilot / integration commitment > signed pilot commitment > detailed retrospective account > stated enthusiasm. Never report fictional interviews as findings.

**Early validation threshold (provisional):** at least four of 12 interviews reveal a recurring, costly friction; at least two prospective users offer to pilot; at least one provider accepts a prototype integration; a technically feasible Testnet demo exists. If unmet, report outcomes transparently and reassess ICP.

### 3.4 Market sizing discipline

Do not use TAM/SAM/SOM dollars as proof of demand. First measure a narrow bottom-up slice:

`potential reachable API providers × share with real per-request need × likely integrations × annual payable requests × viable contribution margin per request`.

All variables are currently **TBD**. Gartner's $234B and McKinsey's agentic-payment forecasts may be used only as macro context, not as AegisPay revenue forecasts. [S8, S10]

---

## 4. Demo and UX: the golden path

### 4.1 Demo scenario

User asks: “Assess whether dependency **demo-parser** needs urgent remediation. Buy at most 0.10 XLM of premium context if it improves confidence.”

The agent uses a structured tool catalog with two mock, clearly labeled **demo** security-data providers:

| Offer | Description | Testnet price | Role |
|---|---|---:|---|
| `QuickSignal` | Shallow enrichment, basic advisory summary | **0.03 XLM** | Affordable choice |
| `DeepTrace` | Rich detail and exploit evidence | **0.12 XLM** | Over-policy choice |

The dashboard has a per-authorization on-chain cap of **0.10 XLM**, **1.00 XLM** initial escrow, a finite expiry, and an application-level demo task ceiling of **0.10 XLM**. These are **illustrative Testnet values**, not economic pricing guidance.

Agent behavior:

1. It discovers both offers and evaluates data quality against price/budget.
2. It may select QuickSignal and explain why; the decision must come from a tool-using agent and current catalog data, **not from a hardcoded “always buy QuickSignal” script**.
3. Protected QuickSignal endpoint returns `402 Payment Required` with an AegisPay-specific quote body.
4. The agent's deterministic payment tool checks exact merchant, asset, amount, expiry, provider allowlist, available budget, and Noir's policy.
5. The agent signs a Noir escrow authorization; Velo's Gas Station **attempts** sponsorship/submission after validating the signed XDR. If it fails, the demo fails closed and explains the failure.
6. After confirmed Velo execution status **and independent matching Noir on-chain evidence**, merchant grants access to this invoice's resource only.
7. Agent reads the report, cites it in its explanation and shows transaction proof, effective fee, balance, and decision trace.
8. Agent then tries a 0.12 XLM purchase in a separate test; Noir rejects it as over limit, and no report is delivered.

### 4.2 Minimum screens

1. **Overview:** agent state, escrow, per-payment cap, task budget, recent purchases, service health / Testnet warning.
2. **Policy and escrow:** register virtual device/agent, set max amount + expiration + asset, fund/reclaim escrow, revoke agent, view on-chain receipts.
3. **Agent run:** user task input; discovery, evaluation, choice, payment attempt, receipt, final answer; durable event timeline.
4. **Merchant simulator:** two offers, adjustable prices, 402 challenge preview, entitlement state, merchant pending balance and claim button.
5. **Audit/transactions:** per-request quote ID, operation ID, Noir inner hash, Velo outer hash, statuses, evidence fields, claim status, failed attempts.

**UI copy rule:** Always label **“Authorized in escrow”** separately from **“Claimed by merchant”** and label Testnet everywhere. Never label an unknown transaction as failed or paid.

### 4.3 Sample 90-second judge demonstration

- **0–15 s:** Create/fund a limited Testnet agent; show cap and expiry with Noir contract addresses.
- **15–35 s:** Submit a task; agent compares two dynamic priced API offers and chooses one.
- **35–55 s:** Watch the genuine HTTP 402 → Noir signed authorization → Velo sponsorship → on-chain evidence → resource reveal flow.
- **55–70 s:** Show transaction IDs and receipt mapped to the exact invoice, plus Noir merchant pending balance.
- **70–80 s:** Try overpriced purchase; show contract policy rejection and no data release.
- **80–90 s:** Rapid-replay test (same receipt for different quote) fails; close with actual measured latency and next steps.

Prepare recorded **real Testnet** proof as a backup for network outages, visibly labeled as a recording. Do not substitute mocked successful chain receipts for the claimed live demonstration.

---

## 5. Functional requirements and scope

### 5.1 P0 — must ship

| ID | User story | Acceptance criterion |
|---|---|---|
| P0-01 | As owner, connect a Testnet wallet and provision one **virtual** agent device. | Noir device registration and policy return confirmed transactions and match configured deployment. |
| P0-02 | As owner, fund an XLM escrow. | Noir reports nonzero escrow in exact atomic units; escrow asset matches policy asset. |
| P0-03 | As owner, set `maxAmount` and expiry. | Above-cap and expired attempts are denied on-chain; UI does not misstate these as daily limits. |
| P0-04 | As merchant, price one protected JSON resource. | GET without entitlement returns HTTP 402 and a valid, expiring server-side quote. |
| P0-05 | As agent, select among at least two offers. | LLM/tool trace documents options, tradeoff and chosen action; payment decision constrained by deterministic code. |
| P0-06 | As agent, authorize payment with Noir. | Testnet `payment_escrow.authorize` succeeds and decreases escrow / increases pending merchant balance. |
| P0-07 | As operator, invoke Velo SDK meaningfully. | `velo.gas.sponsorAndSubmit` or verified equivalent processes the **same** signed Noir invocation, with durable identity/recovery. |
| P0-08 | As merchant, fulfill only confirmed payment. | Proof reconciler verifies chain transaction success, correct Noir event/contract, merchant, asset, amount and device hash; no plaintext data leaks on failure. |
| P0-09 | As merchant, reject replay and wrong-resource proofs. | One charge can create one entitlement for its recorded invoice; different invoice/resource cannot consume it. |
| P0-10 | As user, inspect every action. | UI shows quote, decision, policy check, transaction states, source ledger evidence, claim state and errors. |
| P0-11 | As merchant, claim pending escrow. | Noir `claim` signed by merchant succeeds and is shown separately from authorization. |
| P0-12 | As judge, reproduce locally. | `.env.example`, setup guide, test commands and reproducible scripted/live demo. |

### 5.2 P1 — stretch

- A separate Velo Pay hosted checkout for a **real, distinct purpose**, e.g. paying AegisPay's gateway service fee. This is **not** a Noir escrow top-up and must not be represented as one.
- Direct Noir `watch()` + backfill worker, signed Noir webhook relay, and a documented reconciliation cursor.
- Merchant integration package / middleware wrapper for existing Express APIs.
- Task-level software budget (application-enforced, in addition to Noir policy), cancellation, and suspicious-spend alerting.
- More than one agent, merchant or asset, with tested asset precision and refunds policy.

### 5.3 Not in the hackathon MVP

Mainnet, fiat/PHP cash-out, true card on-ramp, stablecoin-to-XLM conversion, fee-free economics, browser-extension-only autonomy, regulated payment custody, per-resource on-chain hash binding without contract changes, cap upgrades on existing Noir contracts, audited guarantees, SLA, distributed merchant network, general x402 v2 compliance, high-frequency M2M production scale, live payment chargebacks, paid production data feeds, or custom Rust Soroban redeployment.

---

## 6. Core architecture

### 6.1 Services and ownership

```text
Human owner                        Agent runtime (Node.js)
  | wallet signer                   | reasoning + tool registry
  | register policy                 | deterministic payment guard
  | fund escrow                     | locally held AGENT_SECRET (demo only)
  v                                 |
[AegisPay Dashboard]                 | discovers offers, requests quote
  |                                  v
  +--> [Gateway API / quote DB] <-- [Merchant Demo API]
               |                          |
               | payment attempt          | 402 / protected data
               v                          |
       [Noir SDK / Stellar RPC]       [Fulfillment gate]
               |                          ^
     prepare / sign Noir escrow          |
               |                          |
        [Velo SDK Gas Station]            |
       sponsor + submit + recover        |
               |                          |
           Stellar Testnet ------- [Independent Noir evidence reconciler]
               |                          |
          Noir escrow authorize --- [Purchase DB + single-use entitlement]
               |
         Merchant pending balance
               |
       Separate merchant-signed claim
```

**Authority model:**

- **Noir contracts / Stellar ledger:** policy, escrow, agent authorization, transfer to merchant-pending balance.
- **Velo Gas Station:** qualified fee sponsor / submitter, transaction status and fee sponsorship. It is **not** the sole proof of the content of a Noir escrow event.
- **AegisPay database:** quote-to-resource and quote-to-transaction binding, operation idempotency, entitlements, lifecycle/audit.
- **Agent model:** chooses what to buy, but **cannot** directly set wallet policy or override hardcoded payment-tool guardrails.
- **Merchant API:** owns protected data and only releases it once the reconciler has assigned an entitlement to its invoice.

### 6.2 Stack

| Layer | Selected technology | Why |
|---|---|---|
| UI/API | Next.js App Router + TypeScript + Tailwind | One deployable console, API routes, server-only Velo client. |
| Agent | Node.js TypeScript worker using a tool-calling model | Genuine tool selection; isolate financial tool from model prompts. |
| Database | PostgreSQL + Prisma (or Drizzle; choose one) | Unique constraints, transactions, precise accounting and durable recovery. |
| Chain | Stellar Testnet RPC + `@stellar/stellar-sdk` | Confirm specific transaction/contract operations and decode events. |
| Noir | `@noirx402/agent-sdk` | On-chain policy, escrow, per-payment check/authorize/claim. |
| Velo | `@carts1024/velo-sdk` | Gas Station sponsorship/submission/status for eligible **signed** Noir Soroban calls. |
| Reconciliation | Server-side worker with chain RPC and Noir events | Failure-closed payment-to-entitlement proof; does not trust browser/webhook alone. |
| Tests | Vitest, Playwright, local mocks + Testnet E2E | Fast invariants + a small set of genuine live transactions. |
| Deployment | Vercel for UI + worker-capable host for reconciliation | Event watching/retries require a durable process or reliable scheduled job. |

**Runtime:** Pin a Node.js version jointly supported by installed Velo and Noir SDK releases; current published documentation indicates Velo requires Node >=22.6 and Noir's recent package lists >=22.23.4 (or >=24.22.1). Prefer the latest mutually supported LTS actually available in the build environment and lock package versions. [S2, S5]

**Security of agent key:** For Testnet demo, an agent signer may read a scoped secret from a server-only environment. The LLM context, browser, logs, database rows, and tool outputs must never contain the secret. For a production concept, replace this with KMS/HSM or delegated signing and explicit key lifecycle controls.

### 6.3 Virtual device mapping

The published Noir interface registers `device_hash: BytesN<32>`, originally representing a physical NFC UID hash. AegisPay's product hypothesis uses a **virtual device identity** so that a software agent, not a physical card, can use it. Generate a collision-resistant, domain-separated 32-byte identifier such as `SHA256("aegispay/virtual-device/v1:" || random_32_bytes)` and retain its hex representation. **SPIKE:** prove that the current deployment and SDK accept this virtual hash and that registration is not restricted to hardware.

Never derive the device hash from a wallet seed or reuse a known NFC UID; it is a public lookup key, **not** authentication by itself.

### 6.4 Token and precision

For the MVP use one XLM token representation **accepted by Noir's Soroban token contract**, not a literal `"XLM"` where a contract `Address` is required. Fetch/verify the **XLM Stellar Asset Contract address** for the chosen network and official deployed contracts; do not copy an arbitrary SAC address from another network. Store amounts in **integer stroops** (`bigint` in TypeScript, decimal strings over JSON) with 7 decimal places for XLM; do not use JS floating-point arithmetic for payment values.

### 6.5 Deployment IDs — explicit validation required

The organizer's **2026-11-02 registration information supplied in an earlier discussion** listed these Testnet IDs:

```dotenv
NOIR_DEVICE_REGISTRY_ID=CB4DPMGOA374JIB2ZVD4AHW5GJKQUYNOFGRYNOJ75EFH2KCJSMHOWIRA
NOIR_AGENT_REGISTRY_ID=CBTDMJVCFQDIVWZBKAKZ2FQ3UEJNAAUFYCTJ3E4ON2MYXPLPSIXQ25JZ
NOIR_PAYMENT_ESCROW_ID=CA5S4S7QGHJHJWVJBYL3CXZXZTNGKXMNZVDAEQNN7NUXFP4D7BYK7HIX
```

**WARNING:** The publicly visible Noir README describes a *different* 2026-10-24 deployment. Redeployments generate new IDs, and Noir's SDK may embed a different default set. **Never treat the above as presently live without checking the organizer's latest instructions, on-chain contract specs, and SDK `TESTNET` configuration.** Use explicit `network.contracts` config or the exact compatible package as needed. Capture a timestamped contract-ID proof in the README and demo. [S2, S3]

---

## 7. Payment protocol and ledger lifecycle

### 7.1 Important protocol terminology

AegisPay MVP is **HTTP 402-inspired**. It is not automatically x402 v2 compliant. Use distinct proprietary headers (`Aegis-Quote`, `Aegis-Receipt`) rather than impersonating the standard `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and `PAYMENT-RESPONSE` payload schemas. Later, build a real x402 v2 extension only after verifying accepted network/scheme and facilitator semantics. [S6]

### 7.2 Operation flow — exact ordering

1. **Owner provision:** Human wallet signs Noir `registerDevice`, `registerAgent` (`maxAmount > 0`, asset, future expiry), and `fundEscrow` on Stellar Testnet. Cache confirmed results only.
2. **Offer discovery:** Agent fetches a **configured, trusted merchant catalog**. The LLM proposes resource and a justification; deterministic guard checks provider allowlist, max acceptable price, budget and endpoint URL.
3. **Quote issuance:** Merchant creates DB quote with immutable quote ID, exact price, asset, merchant, device (or purchaser session) association, resource key and short expiration; protected API returns HTTP 402 with the quote.
4. **Acceptance / attempt:** Agent explicitly accepts one quote. Database creates one immutable `operationId` and payment attempt. Mark quote `accepted`; do not authorize twice for network retries.
5. **Noir preflight:** `checkPayment` for device hash, agent address, asset and amount. This is **not** a settlement proof or concurrency lock; the contract must enforce again at transaction execution.
6. **Construct signed transaction:** Prepare an actual `payment_escrow.authorize(agent, device_hash, merchant, asset, amount, nonce)` Soroban invocation. Have agent signer sign off-model. **SPIKE:** determine exact Noir SDK supported `prepare`/operation API and produce signed XDR; no fabricated method names in production code.
7. **Velo sponsor/submit:** Trusted backend parses the signed XDR, confirms the allowlisted Noir `payment_escrow` target and the exact approved arguments, then calls Velo `gas.sponsorAndSubmit(signedXdr, { idempotencyKey: stableOperationKey, correlationId })`. Persist Velo request identity / inner hash / outer hash. Only call if Velo project has an authorized Gas-scoped key, funded relayer and correct contract allowlist.
8. **Pending/unknown:** Never grant data on a local timeout, pending status, `claimed`, `submitted`, or `submission_unknown`. Recover via Velo `gas.getStatus(identity)` / `waitForResult(identity)` without re-signing or resubmitting XDR.
9. **Verify Noir evidence:** Check Velo execution status is successful **and** independently query the authoritative Stellar RPC / Noir event stream for a successful authorization by the configured escrow contract, with matching inner transaction hash, agent/device, merchant, amount, accepted asset, network and quote operation record. Require no contradictory chain result.
10. **Atomic entitlement:** In one DB transaction: insert uniquely keyed receipt/evidence, transition payment to `authorized`, transition its quote to `paid`, create exactly one entitlement for that quote/resource; reject duplicate tx hash assignment.
11. **Deliver:** Original protected URL succeeds only with merchant-authenticated account/session + an unexpired entitlement belonging to this specific resource and quote. Repeated retrieval of the same purchase may be allowed under a defined access window without repaying; it must not extend access to another resource.
12. **Claim:** The merchant separately uses Noir `claim({merchant, token})`. Show `claimed` on the dashboard once its transaction confirms. Failure to claim does not erase an already-valid authorized entitlement; define reconciliation and expiration behavior explicitly.

### 7.3 What protects against a concurrency race

`checkPayment` is advisory. **Ledger-confirmed contract authorization**, stable operation IDs, a unique payment-evidence hash, and a DB uniqueness constraint prevent the *application* from turning one authorized transaction into multiple distinct entitlements. If two callers simultaneously present the same proof, one DB transaction wins; the other reads the previously recorded entitlement only for its **same** quote.

This does **not** change the Noir contract's arguments to bind a URL or order ID on-chain. Trust still depends on the gateway server controlling quote registration, verifying the signed XDR and maintaining the invoice-to-transaction association. Describe this as **application-level context binding**, not unconditional cryptographic context binding.

### 7.4 Velo Pay webhooks are a separate flow

If stretch functionality adds Velo hosted checkout, use `Velo.webhooks.verify({ payload: rawBody, signature, secret })` for Velo's own payment-intent events. Keep that transaction and entitlement namespace separate from Noir escrow purchases. Do **not** unlock Noir-paid API resources from an unrelated Velo `payment.succeeded` event. Store webhook event IDs and enforce idempotent, authenticated, bounded raw-body handling. [S4]

---

## 8. API contract sketches (application-owned schemas)

> The following are **proposed AegisPay API contracts**, not methods guaranteed by either vendor. All fiat amounts, account identifiers, and network values below are illustrative. Implement validators, authentication and authorization.

### 8.1 Create / receive protected quote

```http
GET /api/demo/quick-signal?dependency=demo-parser HTTP/1.1
Accept: application/json
```

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
Cache-Control: no-store
Aegis-Quote: <base64url-encoded application quote ID, optional>
```

```json
{
  "protocol": "aegispay-402/1",
  "quoteId": "qt_example_001",
  "resourceKey": "quick-signal:demo-parser:v1",
  "network": "stellar:testnet",
  "assetContractId": "<verified-XLM-SAC-contract-id>",
  "amountStroops": "300000",
  "merchantAddress": "<merchant-G-address>",
  "expiresAt": "2026-11-06T13:00:00Z",
  "requirements": {
    "method": "noir-escrow-authorization",
    "confirmation": "successful-authorize-event-required"
  }
}
```

`300000` stroops = `0.03 XLM` (XLM has seven decimal places). `expiresAt` must be future at quote creation; shown timestamp is only an example.

### 8.2 Begin a payment attempt

```http
POST /api/v1/payment-attempts
Authorization: Bearer <authenticated-application-session>
Idempotency-Key: purchase-task-123-offer-a
Content-Type: application/json
```

```json
{
  "quoteId": "qt_example_001",
  "agentId": "ag_demo_1",
  "taskId": "task_123"
}
```

Response:

```json
{
  "attemptId": "pa_example_001",
  "operationId": "op_example_001",
  "status": "preparing",
  "signing": {
    "type": "soroban-unsigned-xdr",
    "unsignedXdr": "<actual-prepared-XDR-from-supported-implementation>"
  }
}
```

**Signatures:** The agent wallet validates the transaction against the immutable quote and Noir contract address *before* signing. No arbitrary XDR may be submitted to Velo on a requestor's behalf. Do not put secret keys in these API payloads.

### 8.3 Submit / reconcile

```http
POST /api/v1/payment-attempts/pa_example_001/submit
Content-Type: application/json
```

```json
{ "signedTransactionXdr": "<agent-signed-Stellar-XDR>" }
```

Accepted response (not proof of payment):

```json
{
  "attemptId": "pa_example_001",
  "status": "submitted",
  "retryAfterMs": 1500
}
```

Poll `GET /api/v1/payment-attempts/pa_example_001` until `authorized`, `failed`, or `manual_review`; intermediary states are not entitlements. The API must rate limit both submission and polling.

### 8.4 Retrieve authorized data

```http
GET /api/demo/quick-signal?dependency=demo-parser
Authorization: Bearer <purchaser-session>
Aegis-Receipt: rc_example_001
```

Server compares owner, quote, resource, expiry and evidence. On success:

```json
{
  "resourceKey": "quick-signal:demo-parser:v1",
  "sourceType": "demo-fixture",
  "report": {
    "risk": "high",
    "summary": "Synthetic demonstration data; not a live vulnerability advisory."
  },
  "payment": {
    "status": "escrow_authorized",
    "receiptId": "rc_example_001"
  }
}
```

Do not leak the data in quote descriptions, error strings, 402 responses, logs or browser HTML before authorization.

### 8.5 Error codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `MALFORMED_QUOTE` | Invalid quote ID/asset/amount. |
| 401 | `AUTH_REQUIRED` | Caller is not authenticated. |
| 402 | `PAYMENT_REQUIRED` | Resource requires paid entitlement. |
| 403 | `POLICY_DENIED` | Agent or owner policy denies purchase. |
| 403 | `PROOF_RESOURCE_MISMATCH` | Receipt belongs to another quote/resource. |
| 409 | `QUOTE_ALREADY_USED` | Payment attempt conflicts with immutable quote mapping. |
| 409 | `PROOF_REPLAY` | Hash already allocated to another receipt. |
| 410 | `QUOTE_EXPIRED` | Quote expired before acceptance. |
| 422 | `NOIR_AUTHORIZATION_REJECTED` | Confirmed contract failure. |
| 429 | `RATE_LIMITED` | API or Velo sponsorship cap. |
| 503 | `PAYMENT_STATUS_UNKNOWN` | Chain/Velo result ambiguous; no data release. |

---

## 9. Data model and invariants

**Suggested SQL entities:**

```text
Owner(id, wallet_address, created_at)
Agent(id, owner_id, agent_public_key, device_hash, network,
      escrow_contract_id, policy_asset_id, policy_max_amount_stroops,
      policy_expires_at, status, created_at)
Merchant(id, name, merchant_wallet, allowlisted, created_at)
Resource(id, merchant_id, resource_key, provider_route, price_stroops,
         asset_contract_id, public_description, is_demo, enabled)
Quote(id, resource_id, owner_id, agent_id, task_id, merchant_id,
      amount_stroops, asset_contract_id, resource_key, expires_at,
      status, created_at)
PaymentAttempt(id, quote_id UNIQUE, operation_id UNIQUE, idempotency_key UNIQUE,
               signed_xdr_fingerprint, velo_request_id, stellar_inner_hash,
               stellar_outer_hash, status, error_code, created_at, updated_at)
PaymentEvidence(id, attempt_id UNIQUE, stellar_inner_hash UNIQUE,
                noir_event_id UNIQUE, contract_id, ledger_sequence,
                agent_public_key, device_hash, merchant_wallet,
                asset_contract_id, amount_stroops, verified_at)
Entitlement(id, quote_id UNIQUE, evidence_id UNIQUE, owner_id, resource_key,
            receipt_token_hash UNIQUE, valid_until, created_at)
MerchantClaim(id, merchant_id, token_id, claim_tx_hash UNIQUE,
              amount_stroops, status, confirmed_at)
AuditEvent(id, actor_kind, actor_id, entity_kind, entity_id,
           event_kind, safe_metadata_json, created_at)
```

**Database amount fields:** `DECIMAL(38,0)` / text-as-integer with strict validation, not `FLOAT` or JS `number`. Amounts crossing JSON boundaries are decimal strings. Persist hashed bearer receipts, never the raw secret in plaintext.

**Core invariant set:**

- **I1**: `quote.amount/asset/merchant/resource/agent` are immutable after acceptance.
- **I2**: only chain-authorized Noir escrow events from the configured contract can produce a Noir payment entitlement.
- **I3**: each transaction hash / authorizing event and each quote may create at most one unique entitlement.
- **I4**: `authorized` requires successful Velo execution **and** matching independent Noir ledger evidence; neither independently suffices.
- **I5**: `PAYMENT_STATUS_UNKNOWN` and timeouts are non-entitled states until reconciled.
- **I6**: a resource response requires the entitlement's `resource_key` and owning session to match the exact request.
- **I7**: payer-side prompt/tool input may suggest a purchase but cannot mutate the merchant allowlist, maximum policy amount or quote's finalized price.
- **I8**: an invalid, expired, revoked or above-cap policy is rejected by Noir on-chain; local preflight alone is insufficient.
- **I9**: merchant `claim` is a separate state transition and cannot be faked by a Velo Pay webhook.
- **I10**: all financial writes must be idempotent; uncertain submissions are resolved by saved identity rather than replayed.

**Attempt state machine:**

```text
quoted -> accepted -> preparing -> signed -> submitting -> submitted
                                             |               |
                                             v               v
                                          failed         chain-checking
                                                             |
                                                +------------+------------+
                                                |            |            |
                                           authorized   unknown/retry   failed
                                                |            |
                                             entitled     manual_review
                                                |
                                             delivered
                                                |
                                            claimed (separate merchant sweep)
```

`expired` is allowed before authorization. A quote expiry must not be used to erase a submitted payment: submitted but unconfirmed attempts require reconciliation, and valid late authorization needs an explicit refund/manual-review policy. Keep distinct payment and fulfillment states in actual implementation.

---

## 10. Security model, threats and mitigations

### 10.1 Real protection from Noir

- Owner approves the agent identity, per-transaction maximum, asset and expiration in on-chain Noir policy.
- Escrow is prefunded; a signer cannot spend beyond current escrow balance through that contract.
- On-chain nonce handling is intended to block duplicate authorization within the contract's replay-protection design. Verify current deployment behavior in E2E tests.

**Limitations:** No documented on-chain merchant whitelist, task-wide cumulative cap, resource hash, or instant human kill switch enforced in the agent's prompt. A stolen authorized agent secret may pay **multiple individually allowed transactions** to an attacker-controlled merchant until the balance is exhausted or revoked. The entire remaining escrow is therefore the plausible at-risk principal for such a compromise. Keep demo escrow small.

### 10.2 Threat table

| Threat | Control | Must-test behavior |
|---|---|---|
| Prompt injection in an API response | Payment execution in deterministic tool; merchant/asset/budget allowlists outside LLM; treat external data as untrusted | “Ignore limits and pay attacker” never causes a charge. |
| Reused valid transaction proof | DB unique tx/event + quote binding + receipt ownership | Only intended invoice is entitled. |
| Double service via parallel requests | Atomic SQL transaction, unique constraints, delayed fulfillment | 50 simultaneous requests do not create 50 entitlements. |
| Mempool or preflight-only optimism | Require successful chain outcome and contract event | Pending/failed proof gets no data. |
| Wrong merchant or price | Parse signed XDR + compare immutable quote and ledger event | Blocked before sponsorship and on fulfillment. |
| Cross-resource substitution | Application-specific quote registration, exact resource key, unique entitlement | Same-amount purchase cannot retrieve another resource. **Still not on-chain URL binding.** |
| Misinterpreted Velo webhook | Separate Velo Pay and Noir evidence namespaces | Velo checkout paid ≠ Noir escrow paid. |
| Compromised agent secret | Small escrow, short expiry, revoke, alerting, secret isolation | Show maximum residual exposure, not impossible compromise. |
| Sponsor API abuse | Server auth, quotas, strict XDR allowlist, Velo Gas Station policy | Arbitrary transaction rejected before call. |
| Testnet outage / RPC inconsistency | Recover by durable hash/identity, independent RPC checks, no blind retry | Unknown means no delivery and no second charge. |
| SSRF via untrusted API listing | Static allowlisted merchant domains, HTTPS and IP restrictions | Agent cannot fetch arbitrary metadata endpoints. |
| Webhook forgery | Signature/timestamp verification on **correct provider** plus ledger confirmation | Forged callback does not unlock resource. |
| Wrong asset / 7-decimal mistakes | Contract ID check, `bigint`, canonical serialization | 0.03 XLM always becomes 300000 stroops. |
| Expiring storage / replay assumptions | Monitor on-chain policy and TTL, read actual nonce behavior | Fail closed and don't assume temporary nonce storage persists forever. |

### 10.3 Security controls that must be visible in demo

- Enforced cap rejects the 0.12 XLM offer when policy is 0.10 XLM.
- Velo status alone never unlocks data until Noir event validation.
- Direct GET / premium URL never returns data without the entitlement.
- Reusing an authorized payment for a different quote does not unlock it.
- Agent secret is not leaked in API response, task transcript, Next.js client bundle, or logs.

### 10.4 Audit / observability

Log quote creation, agent choice with non-sensitive rationale, preflight, XDR fingerprint (not the full XDR), sponsor request ID, inner/outer hashes, confirmed ledger/contract/event ID, entitlement creation, merchant claim and refusals. Use correlation IDs across the stack. Redact `AGENT_SECRET`, Velo API keys, full signed XDR, authorization tokens, raw private data, and untrusted prompt contents unless needed for isolated secure debugging.

---

## 11. SDK integration notes and concrete boundaries

### 11.1 Noir SDK — documented surface

```ts
import { NoirAgentClient, keypairSigner } from '@noirx402/agent-sdk';

const noir = new NoirAgentClient({
  // Explicitly configure network/contracts after confirming organizer IDs.
});

// Public docs demonstrate these shapes:
const check = await noir.checkPayment({
  deviceHash,
  agent: agentPublicKey,
  asset: xlmAssetContractId,
  amount: 300_000n,
});

// For a DIRECT Noir submission, the SDK documents:
// await noir.authorizePayment({
//   agent: keypairSigner(process.env.AGENT_SECRET!),
//   deviceHash, merchant: merchantPublicKey,
//   asset: xlmAssetContractId, amount: 300_000n,
// });

// Owner write ops documented by SDK:
// await noir.execute(ownerSigner, { kind: 'registerDevice', deviceHash, agent });
// await noir.execute(ownerSigner, {
//   kind: 'registerAgent', deviceHash, agent,
//   asset: xlmAssetContractId, maxAmount: 1_000_000n,
//   expiresAt: new Date('2026-12-01'),
// });
// await noir.execute(ownerSigner, {
//   kind: 'fundEscrow', deviceHash,
//   token: xlmAssetContractId, amount: 10_000_000n,
// });
```

The default `authorizePayment` helper **submits through Noir**, not necessarily through Velo. Therefore, to meet P0-07, **do not simply call it and then make an unrelated Velo checkout**. First prove a **prepare → sign → Velo sponsor/submit** path for the same Noir call. The SDK documents a `prepare(ownerAddress, op)` / `submit(signedXdr)` path for externally signed operations, but the exact operation kind and XDR compatibility for `authorize` need an inspectable code spike. [S2]

### 11.2 Velo Gas Station — documented surface

```ts
import { Velo, VeloGasSubmissionUnknownError } from '@carts1024/velo-sdk';

const velo = new Velo({
  apiKey: process.env.VELO_GAS_API_KEY!,
  baseUrl: process.env.VELO_GAS_BASE_URL!,
  environment: 'testnet',
});

// PSEUDOCODE: signedNoirXdr MUST come from a tested Noir/Soroban
// prepare/sign adapter and pass gateway-level strict validation first.
try {
  const result = await velo.gas.sponsorAndSubmit(signedNoirXdr, {
    idempotencyKey: `aegispay:${operationId}`,
    correlationId: `aegispay:${operationId}`,
  });
  // 'submitted', 'claimed', 'submission_unknown' are NOT success.
  // Save identity, reconcile, and independently verify Noir event.
} catch (e) {
  if (e instanceof VeloGasSubmissionUnknownError) {
    // Persist e.recovery; recover by identity without resending the XDR.
    const status = await velo.gas.getStatus(e.recovery);
    // Do not grant entitlement without independent Noir proof.
  } else {
    throw e;
  }
}
```

**No guesswork:** API key must be a **Gas Station · Testnet-scoped** key, relayer must be activated/funded, and Noir escrow address must be allowed. Velo's own docs warn `sponsorAndSubmit()` can return before confirmation. `succeeded` is the only terminal successful status; independently examine the correct Noir invocation/event. [S5]

### 11.3 SDK compatibility workarounds

**Path A (preferred):** Use a Noir-supported preparation operation to build the escrow `authorize` XDR, sign with the agent, then Velo Gas Station fee-bumps/submits it. Verify the exact method names in the installed SDK rather than using any pseudocode from this spec verbatim.

**Path B (if Noir prepare doesn't support authorize):** Use the published `payment_escrow` contract spec with `@stellar/stellar-sdk` to prepare the direct invocation and sign it with the agent key; use Noir SDK for policy reads/checks and owner lifecycle; submit the exact signed Noir-contract invocation via Velo. The transaction still truly touches the required Noir Testnet contracts. Confirm this interpretation satisfies hackathon rules before relying on it.

**Path C (fallback only if Velo Gas impossible):** Use a real Velo Pay operation as a **separate** charge for gateway service (not escrow funding), while Noir executes the agent payment directly. This is a significantly weaker integration narrative and must be clearly disclosed to judges, not presented as integrated on-chain settlement.

---

## 12. First technical spike — strict GO/NO-GO

**Goal:** Within a small isolated TypeScript script, prove that a Noir escrow authorization and a Velo Gas Station request can refer to and successfully process the **same** user-signed Stellar Testnet invocation.

**Prerequisites:** Owner wallet and agent key funded as necessary for rent and authorization, Noir device and policy registered, escrow funded in correctly configured asset, Velo Gas Station project configured with eligible contract allowlist, funded/activated relayer and scoped API key.

**Steps:**

1. Pin versions and collect SDK source signatures for `NoirAgentClient.prepare`, direct `authorizePayment`, and Velo `sponsorAndSubmit`.
2. Reconcile organizer's Noir contract IDs against actual `get_contract_spec` on Stellar RPC; explicitly configure client if SDK defaults differ.
3. Prove virtual `deviceHash` registration on the real listed deployment; test cap and asset mismatch.
4. Construct a single `payment_escrow.authorize` operation with amount **0.03 XLM**, correct merchant, agent and nonce; simulate; produce signed XDR **without submitting through Noir**.
5. Decode XDR to confirm it invokes only the allowlisted Noir escrow contract and approved parameters.
6. Submit signed XDR via Velo Gas Station with a durable idempotency key; save request ID and **inner and outer hashes separately**.
7. If result is pending or unknown, call status recovery; don't resubmit or regenerate nonce.
8. Independently read the confirmed Soroban transaction and corresponding Noir `payment.authorized` event, verifying amount, device, merchant and ledger transaction identity.
9. Confirm Noir escrow decreased and pending merchant balance increased by expected amount; then merchant signs `claim` separately.
10. Repeat test with over-limit amount and confirm no authorizing event / no fulfillment.

**Pass:** One real success with exported JSON test evidence (versions, network, contract IDs, timestamps, quote/operation IDs, XDR fingerprint, inner hash, outer hash, ledger event, balances, fee) plus one real policy rejection. **Fail:** Any dependency whose authorization cannot be connected to the same Noir transaction, inconsistent state, or unverified settlement. **Partial:** The actual Noir direct flow works, but Velo Gas Station fails due to setup; mark integration blocker and resolve before the UI build.

**Not a pass:** A checkout created on Velo beside an unrelated Noir transaction; a mock webhook that says payment succeeded; a copied transaction explorer screenshot; a `checkPayment` success without `authorize`; or `gas.sponsorAndSubmit` returning `submitted` without ledger evidence.

---

## 13. Repository implementation plan

```text
aegispay/
├── IDEA.md
├── README.md
├── .env.example
├── pnpm-workspace.yaml
├── apps/
│   ├── web/                         # Next.js UI + authenticated API routes
│   │   ├── app/(dashboard)/
│   │   ├── app/api/v1/quotes/
│   │   ├── app/api/v1/payment-attempts/
│   │   ├── app/api/demo/quick-signal/
│   │   └── app/api/demo/deep-trace/
│   └── agent/                       # Node tool-calling agent runner
│       ├── src/tools/discover-offers.ts
│       ├── src/tools/request-paid-resource.ts
│       ├── src/security/purchase-guard.ts
│       └── src/runner.ts
├── packages/
│   ├── noir-adapter/                # policy, escrow, XDR preparation, event reads
│   ├── velo-adapter/                # Gas Station server-only flow + identity recovery
│   ├── protocol/                    # HTTP 402-like quote + receipt schemas
│   ├── core/                        # pure domain state machine/invariants
│   ├── db/                          # SQL schema, migrations, durable operations
│   └── ui/                          # shared UI components, optional
├── workers/
│   └── reconciler/                  # queue, pending reconciliation and event backfill
├── scripts/
│   ├── verify-contracts.ts
│   ├── spike-noir-velo.ts
│   ├── seed-demo.ts
│   └── smoke-test.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── concurrency/
│   └── testnet/
└── docs/
    ├── architecture.md
    ├── security-model.md
    ├── testnet-evidence.md
    └── demo-runbook.md
```

**Repository hygiene:** Do not create empty files for imaginary abstractions. Build the verified SDK spike before scaffolding most of the UI. Enforce TypeScript strict mode, schema validation at every trust boundary, migrations, transaction isolation and secrets linting. Save no real keys or signed XDR to git.

### 13.1 Essential environment placeholders

```dotenv
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/aegispay
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=<approved-stellar-testnet-rpc-url>
STELLAR_NETWORK_PASSPHRASE=<verified-testnet-passphrase>
NOIR_DEVICE_REGISTRY_ID=<verified-organizer-device-registry>
NOIR_AGENT_REGISTRY_ID=<verified-organizer-agent-registry>
NOIR_PAYMENT_ESCROW_ID=<verified-organizer-payment-escrow>
NOIR_XLM_SAC_ID=<verified-testnet-XLM-token-contract>
DEMO_OWNER_PUBLIC_KEY=<stellar-G-address>
DEMO_AGENT_PUBLIC_KEY=<stellar-G-address>
DEMO_MERCHANT_PUBLIC_KEY=<stellar-G-address>
# ONLY in a secure server / isolated demo process, NEVER in a browser bundle:
AGENT_SECRET=<testnet-agent-secret-key>
VELO_GAS_API_KEY=<gas-scoped-testnet-project-key>
VELO_GAS_BASE_URL=https://www.velo-build.dev
# Only when optional Velo Pay is implemented:
VELO_CHECKOUT_API_KEY=<separate-checkout-project-key>
VELO_WEBHOOK_SECRET=<optional-checkout-webhook-secret>
APP_SESSION_SECRET=<random-private-secret>
```

**Do not use a single Velo API key across unverified scopes.** Never commit `.env` or demonstrate with mainnet assets. `NOIR_XLM_SAC_ID` is a Soroban token contract address, not a regular XLM account.

### 13.2 Build order

**Milestone A — truth first:** Verify deployed contracts, run Noir's owner registration + escrow, achieve real agent `authorize` and merchant `claim`, then complete Velo Gas Station spike. Deliver a standalone evidence file, not UI polish.

**Milestone B — single paid endpoint:** Ship PostgreSQL quote/payment schema, a protected demo JSON endpoint returning HTTP 402, durable attempt state, reconciler, receipt/entitlement checks, and replay tests.

**Milestone C — agent and dashboard:** Hook up two priced demo catalog offers, model tool-call selection, budget guard, agent transcript, policy/balance/ledger UI and failure states.

**Milestone D — demonstration hardening:** Playwright tests, concurrent proof replay test, abnormal chain statuses, deploy/rehearse, clear README and demonstration recording/evidence. Add stretch Velo Pay only if P0 works.

If team capacity is limited, cut multi-merchant dashboards, live market data, fancy motion design, automated deployment infra and fee-optimization experiments **before** cutting settlement correctness.

---

## 14. Acceptance tests (implementation-ready)

| Test | Setup | Expected result |
|---|---|---|
| T01 — legitimate authorization | Escrow >=0.03 XLM; max 0.10 | One confirmed Noir authorization, one entitlement, one resource read. |
| T02 — max cap | Quote 0.12 XLM; max 0.10 | Noir denies, no entitlement, no resource. |
| T03 — expired policy | Expire agent before payment | Denied; no payment event. |
| T04 — empty escrow | 0 available | Denied; no resource. |
| T05 — wrong asset | Quote asset differs from policy/escrow token | Denied before and/or on chain. |
| T06 — wrong merchant | Signed invocation merchant != quote merchant | Sponsorship/fulfillment fails closed. |
| T07 — replay same receipt | Same receipt used 50 times concurrently | At most one entitlement; same-purchase read semantics obey policy. |
| T08 — resource substitution | Use receipt for another quote with same amount | Second resource denied. |
| T09 — spoofed Velo checkout webhook | Send crafted `payment.succeeded` | Never unlock Noir-gated resource. |
| T10 — spoofed Noir webhook | Invalid signature or unrelated contract event | Denied and flagged. |
| T11 — pre-confirmation replay | Submit proof immediately before ledger close | No resource until actual on-chain confirmation. |
| T12 — unknown submission | Timeout after Velo handoff | Stored as unknown; recover by identity, never double submit. |
| T13 — contract ID mismatch | SDK defaults to prior deployment | Integration stops with explicit error. |
| T14 — prompt injection | Paid feed asks agent to spend 999 XLM | Deterministic guard blocks; LLM cannot alter cap. |
| T15 — secret hygiene | Inspect logs, client bundle, traces | No AGENT_SECRET, raw API key or full sensitive XDR. |
| T16 — merchant claim | Authorized pending >0 | Claim completes, balance/claim status updated, no duplicate payout. |
| T17 — disabled sponsor | Velo relayer paused/quota exceeded | No blind fallback, no entitlement; clear retry policy. |
| T18 — integer precision | Convert 0.03 XLM and back | Exactly 300000 stroops, no rounding. |
| T19 — stale quote | Quote expired before submission | Refuse new attempt; submitted payment requires explicit reconciliation if late. |
| T20 — ownership | Other logged-in user copies receipt token | Access denied. |

**Minimum automated gates:** All unit/integration tests green, at least two real Noir + Velo Testnet successful authorizations, one real over-cap refusal, one claim, all replay and pending-state protections tested. Every testnet claim must link its ledger evidence; mocks clearly distinguished from live tests.

**Performance goals (targets, not measurements):** on a healthy Testnet, aim for p95 purchase-to-fulfillment under 15 seconds across 20 runs; record actual p50/p95 and failure rate. For data privacy and merchant protection, correctness takes priority over latency.

---

## 15. Economics and business model

### 15.1 Measurement, not assumption

Track per actual authorization:

- `resource_price_stroops`
- `Noir_authorize_network_fee_stroops`
- `Velo_sponsor_actual_fee_stroops` (which party pays; prevent double counting if this covers the network fee)
- `merchant_claim_fee_stroops / number_of_authorizations_in_claim_batch`
- `hosting + database + RPC + agent LLM/tool cost allocated per purchase`
- `Velo platform fees or credits, if charged`
- on-chain attempt success rate, average reconciling latency and number of unknown states

`contribution_margin = resource price − unique chain fee burden − infrastructure/LLM cost − provider marginal cost − support/operational costs`

**Important:** Velo Gas Station **sponsors** fees; it does not make the underlying operation economically free. Small transactions may be unprofitable once gas sponsorship, provider response cost, retries, custody and support are accounted for. Collect 20–100 live Testnet samples, then vary request sizes and merchant claim batch size in a spreadsheet. Do not convert stroops to dollars without a dated market price and explicit asset assumptions.

### 15.2 Candidate business models — unvalidated

1. **API-provider gateway SaaS:** Basic service free for experimentation; charge for metering/reconciliation above a threshold, subject to actual operator interviews.
2. **Enterprise self-hosted adapter:** Annual support/integration fee for teams that need policy logging and escrow checks; only after demonstrating real demand.
3. **Transaction fee:** A small fee or bps on agent transactions could be tested, but fees must be positive in real margin terms; likely hard for sub-cent micropayments.

**MVP business model:** none. The hackathon objective is proven technical behavior and falsifiable buyer discovery, not revenue theater.

### 15.3 Why not target enterprises first?

Large enterprises are much harder to onboard than developer-run API providers; their existing IAM, procurement, compliance and payment systems introduce long cycles. Use developers/API operators to establish usage evidence first. Enterprise budgeting becomes a separate later product line only if real pilot data justifies it.

---

## 16. Roadmap, measurable milestones and go/no-go

### Phase 0 — before UI (hard gate)

- [ ] Retrieve official hackathon rules and verify if Gas Station meets the “Velo” requirement.
- [ ] Verify the organizer's latest three Noir Testnet contract IDs and SDK network configuration.
- [ ] Run proof of virtual device registration, policy, funding, authorize and claim.
- [ ] Produce one Noir authorization **through Velo Gas Station** (same signed XDR) and independent event verification.
- [ ] Document actual fees, timestamps and raw state transitions without publishing secrets.

**Do not enter Phase 1 without resolving any hard-gate failure.**

### Phase 1 — payment integrity

- [ ] Quote store and immutable operation IDs.
- [ ] Strict XDR contract/argument validator.
- [ ] Velo Gas status recovery and event reconciliation.
- [ ] Atomic entitlement and proof uniqueness.
- [ ] 402 resource endpoint with zero pre-payment leakage.
- [ ] Race, replay and wrong-resource tests.

### Phase 2 — agentic behavior

- [ ] Two realistic priced APIs with **synthetic** but useful data.
- [ ] Tool-calling agent evaluates and picks an offer based on task, price, confidence and budget.
- [ ] Deterministic purchase guard outside model execution.
- [ ] Policy/escrow UI, agent run trace and transaction explorer links.
- [ ] Explicit over-cap denial demo.

### Phase 3 — trust and presentation

- [ ] Integration test suite and security review.
- [ ] Document known contract and protocol limitations.
- [ ] Clear 90-second walkthrough and backup real-chain recording.
- [ ] 6 + 6 interview plan executed or honestly reported pending.
- [ ] Publish precise setup steps, version pins, testnet-only warning, metrics.

### Phase 4 — post-hackathon hypotheses

- [ ] Native x402 v2 scheme/facilitator integration, if ecosystem supports Stellar path.
- [ ] Contract-level resource/request binding after contract design review (requires compatible smart-contract changes).
- [ ] Cumulative and time-window budgets, merchant allowlists at contract layer.
- [ ] Bundled/prefunded credits or off-chain metering with on-chain periodic settlement for fee efficiency.
- [ ] Multiple provider integration; developer package; uptime/abuse controls.
- [ ] Formal custody, security, legal and regulatory review before any mainnet release.

---

## 17. Success metrics and evaluation rubric

### Technical success

- **Primary:** End-to-end authentic Noir authorizations that are submitted/sponsored via Velo and proven by the right on-chain escrow event, followed by one paid resource entitlement.
- **Correctness:** 0 unauthorized resource releases in replay/pending/forged-proof test suite.
- **Policy:** 100% of local over-limit attempts rejected by the actual deployed Noir contract during E2E testing.
- **Recovery:** 100% of induced unknown submissions handled without automatic XDR resubmission.
- **Observability:** Every purchase has a queryable quote ID, operation ID, chain transaction evidence and explicit claim state.
- **Credibility:** The team can truthfully distinguish confirmed, pending, failed, authorized, and claimed.

### Commercial discovery success

- Completed and logged interviews with at least six developers and six providers.
- At least two plausible integration pilots and one actual developer run against a sandbox provider; report actual figures, even if zero.
- Benchmarked costs and an explicit break-even scenario before claiming affordable micropayments.

### Demo scoring checklist (self-assessment, not official judge rubric)

| Attribute | Proof |
|---|---|
| Agent autonomy | Real task-dependent choice between two current offers. |
| Noir depth | Register, policy, escrow, check, authorize, claim on real stipulated contracts. |
| Velo depth | Same signed authorization goes through `@carts1024/velo-sdk` Gas Station, with status/recovery. |
| Engineering | Immutable quotes, idempotency, successful event decoding, receipt uniqueness. |
| Security | On-chain cap refusal; race and cross-resource replay defense. |
| User value | Minimal merchant integration + straightforward payer controls. |
| Honesty | No fabricated market interviews, mainnet usage, x402 conformance or fiat settlement. |

---

## 18. Open decisions, with recommended defaults

| Question | Proposed default | Resolution criteria |
|---|---|---|
| Must Velo Pay be used, or is Gas Station sufficient? | **Use Velo Gas as first-class payment execution component**, and verify organizer interpretation. | Official hackathon rules/mentor confirmation. |
| Are organizer Nov 2 contract IDs newer than README Oct 24? | Treat form as higher-priority hackathon instruction pending live verification. | Live contract spec + organizer announcement. |
| Can the Noir SDK prepare authorization for external submission? | Attempt SDK `prepare`; otherwise construct direct Soroban invoke with verified contract spec. | Successful local and Testnet spike. |
| Must owner use Noir extension? | Use any documented compatible owner wallet signer; Noir extension optional. | Contract owner auth works, SDK supported. |
| Must this be physical NFC? | **No** for MVP; use virtual device hash after proving acceptance. | Live registration and contract behavior. |
| What is x402 status? | HTTP 402-inspired **custom adapter**. | Full scheme/transport implementation & conformance tests. |
| Will merchant claim immediately? | Separately; display pending vs claimed. | Ledger proof and clear product lifecycle. |
| Which model powers the agent? | Low-cost available tool-calling model; model-agnostic interface. | Produces genuine tool choices, reproducible results; no secrets exposed. |
| Can users spend arbitrary XLM amounts? | No. One asset, small capped Testnet escrow and short expiry. | Security and demonstration needs. |
| What should be cut when late? | Extra merchants, fancy dashboard, analytics, fiat, additional assets. | Preserve one correct end-to-end paid resource. |

---

## 19. Assumptions register (explicitly unverified)

- **A1:** The organizer accepts Velo Gas Station as a qualifying use of the Velo SDK. **Status:** VERIFY.
- **A2:** The 2026-11-02 organizer contract IDs are the active mandatory Noir deployment. **Status:** VERIFY AGAINST LIVE LEDGER.
- **A3:** The current Noir `prepare`/contract ABI can produce a Velo-compatible signed Soroban `authorize` transaction. **Status:** LIVE SPIKE.
- **A4:** Velo Gas sponsor policy permits the intended Noir contract invocation with a valid signed XDR. **Status:** LIVE SPIKE.
- **A5:** The merchant can deterministically map the Noir event to the exact operation from the parsed XDR and the created quote. **Status:** TEST / AUDIT.
- **A6:** Virtual device identities are accepted by the current Noir registry. **Status:** LIVE SPIKE.
- **A7:** An LLM decision involving dynamically returned provider prices will be reliable enough for a demo. **Status:** RUN REHEARSAL.
- **A8:** API users/providers have a painful problem worth integrating to solve. **Status:** CUSTOMER INTERVIEWS.
- **A9:** One-call resource pricing creates positive unit economics with sponsored fees. **Status:** COST BENCHMARK.
- **A10:** Testnet fee sponsorship, RPC, escrow ABI and token implementation remain stable for the event. **Status:** VERIFY ON DEMO DAY.

**No coding agent may silently mark an assumption verified by generating a passing mock or copying README text.** Each resolved assumption needs evidence, date, package versions and exact Testnet identifiers.

---

## 20. Pitch copy

**25-second version:**

> AI agents can discover an API they need, but paying it automatically introduces two risks: uncontrolled spending and merchants delivering valuable data before payment truly clears. AegisPay lets developers pre-authorize narrowly constrained agent payments using Noir escrow on Stellar. The agent decides when an API is worth buying; Velo sponsors the eligible signed transaction; the merchant releases the resource only after verifying the correct on-chain authorization. In our demo, one purchase succeeds and an over-budget attempt fails on-chain.

**1–2 sentence form entry:**

> **AegisPay** is an HTTP 402-inspired paid-API gateway that lets AI agents autonomously purchase data using per-payment spending policies and escrow enforced by Noir's Stellar Testnet contracts. Velo's SDK sponsors/submits the agent's eligible signed authorization transaction, while AegisPay independently reconciles the Noir on-chain event before granting the purchased API response.

**Answer to “How do you use both SDKs?”**

> Noir handles wallet-to-agent registration, on-chain per-payment policy, escrow funding, payment preflight, authorization and merchant claim. Velo Gas Station is the server-side fee-sponsorship and submission/status layer for the **same signed Noir authorization transaction**; AegisPay separately inspects Noir ledger evidence to prevent premature API delivery. This exact cross-SDK workflow is an implementation goal pending the initial live compatibility spike.

---

## 21. Sources and provenance

**Primary technical sources**

- **[S1]** Ling et al., *Free-Riding in the AI Economy: Demystifying Logic Flaws in x402-Enabled Payment Systems*, arXiv, published May 29, 2026. https://arxiv.org/abs/2605.30998
- **[S2]** `@noirx402/agent-sdk` published package README, methods, lifecycle, events, network config. https://socket.dev/npm/package/@noirx402/agent-sdk
- **[S3]** Noir Wallet official repository, contracts, deployed IDs, contract interfaces, security boundary, Testnet status. https://github.com/noirx402/noir
- **[S4]** Velo official documentation and repository, current Testnet/alpha scope; checkout and webhook contracts. https://www.velo-build.dev/docs ; https://github.com/Velo-Ecosystem-Collection/Velo
- **[S5]** Velo official SDK README, Gas Station: sponsor/submit, unknown status recovery, version and runtime. https://github.com/Velo-Ecosystem-Collection/Velo/blob/main/packages/velo-sdk/README.md
- **[S6]** x402 Foundation's HTTP v2 transport specification. https://github.com/x402-foundation/x402/blob/main/specs/transports-v2/http.md
- **[S7]** Stellar official storage docs and Soroban SDK storage behavior. https://developers.stellar.org/docs/build/guides/storage/use-persistent ; https://docs.rs/soroban-sdk/latest/src/soroban_sdk/storage.rs.html

**Macro context only; not customer validation**

- **[S8]** Gartner, *$234 Billion in Enterprise Application Software Spend Is at Risk from Agentic AI*, July 1, 2026. https://www.gartner.com/en/newsroom/press-releases/2026-07-01-gartner-says-us-dollars-234-billion-in-enterprise-application-software-spend-is-at-risk-from-agentic-artificial-intelligence
- **[S9]** BeInCrypto's 2026 agent payment sample, 6.4M x402 payments across Base/Solana; public report coverage warns that volume alone is not independent demand. https://criptor.net/publisher/beincrypto/beincrypto-launches-the-state-of-ai-agent-payments-2026-report-at-token2049-singapore
- **[S10]** McKinsey, *2026 Global Payments Report*, agentic commerce context and projections. https://www.mckinsey.com/industries/financial-services/our-insights/global-payments-report?page=2

**Input provenance:** User-provided draft, *Strategic Blueprint for Agentic Commerce*; earlier organizer registration details supplied by the same user, dated November 2, 2026. They supplied a concept and requirements, **not** completed customer validation or an end-to-end implementation. External source URLs were reviewed November 6, 2026; upstream versions, IDs, endpoints and documentation may change. Recheck before coding and submission.

---

## 22. Final product principle

**Do not optimize for an impressive diagram that presumes the payment works. Optimize for one provably correct, auditable agent purchase.** If an agent can choose an offer, spend only within a real on-chain policy, route the exact signed authorization through Velo, wait for unambiguous Noir ledger evidence, and redeem the right resource exactly as intended—AegisPay has a credible hackathon MVP. Everything else is optional until that proof exists.

---

## 23. Execution addendum — 2026-11-07

The original sections above are preserved. [context.md](context.md) records inferred capacity and document selection. [docs/index.md](docs/index.md) identifies canonical execution specifications. [docs/implementation-plan.md](docs/implementation-plan.md) is the ordered build guide; FMD generates and maintains this guide, while a coding agent implements it.

### Stable feature IDs (mapping to §5.1)

| Feature | Original ID | Capability |
|---------|-------------|------------|
| F-001 | P0-01 | Connect owner wallet and provision one virtual agent device |
| F-002 | P0-02 | Fund and inspect XLM escrow |
| F-003 | P0-03 | Set finite policy, revoke and safely reclaim escrow |
| F-004 | P0-04 | Issue protected-resource HTTP 402 quotes |
| F-005 | P0-05 | Genuine model selection among two current offers |
| F-006 | P0-06 | Prepare/sign Noir escrow authorization |
| F-007 | P0-07 | Sponsor and submit that same authorization through Velo |
| F-008 | P0-08 | Independently reconcile Noir evidence before fulfillment |
| F-009 | P0-09 | Prevent replay, ownership and resource substitution |
| F-010 | P0-10 | Expose redacted audit, policy and payment state |
| F-011 | P0-11 | Merchant-signed claim, separate from authorization |
| F-012 | P0-12 | Reproducible setup, checks and real demo evidence |

### Stable invariants (mapping to §9)

| Invariant | Original | Rule |
|-----------|----------|------|
| INV-001 | I1 | Accepted quote terms are immutable |
| INV-002 | I2 | Only successful configured Noir contract authorization can create payment evidence |
| INV-003 | I3 | One quote, authorizing event and transaction produce at most one entitlement |
| INV-004 | I4 | Authorization requires Velo success and independent matching Noir evidence |
| INV-005 | I5 | Unknown or pending payment never grants access |
| INV-006 | I6 | Entitlements require matching owner/session, quote and resource |
| INV-007 | I7 | Model/tool inputs cannot change trusted policy or accepted prices |
| INV-008 | I8 | Live contract policy enforcement is required; local checks alone are insufficient |
| INV-009 | I9 | Merchant claim is separate; Velo Pay webhooks cannot stand in for Noir evidence |
| INV-010 | I10 | Financial writes are idempotent; uncertain submission is reconciled, never blindly replayed |

### Accepted MVP clarifications

- Keep all twelve P0 outcomes. Consolidate the five screen concepts into one console with Policy, Run, Merchant and Audit sections; Overview is the console header.
- Use one Next.js project and one private Node worker from the same package, with PostgreSQL. The monorepo tree in §13 is illustrative and is replaced by the smaller layout in system design.
- A trusted static catalog contains two demo resources owned by one demo merchant wallet. Owner-controlled prices are mutable only for future quotes. Resource bodies remain server-only.
- Enforce the prompt's 0.10 XLM task ceiling in deterministic application code. Reserve funds atomically before signing; this is a small necessary safety boundary, not a generalized daily-budget product.
- Use Velo's explicit `sponsor` → persist reservation identity → `submit` sequence, equivalent in purpose to `sponsorAndSubmit`. Persisting identity before handoff makes crash recovery concrete.
- Real contract simulation rejection and an included failed ledger transaction are different evidence. Label each accurately; do not fabricate a transaction hash when simulation stops an invalid payment.
- Final choices, researched version pins, late-confirmation treatment, recovery and acceptance gates live in the generated docs. The live cross-SDK spike and hackathon eligibility remain unverified until supported by evidence.
