# Console UX specification

## Finals redesign direction — 2026-11-09

The user explicitly replaces the plain preparation-era visual defaults below with a substantial modern redesign, drawing from Magic UI, Watermelon UI and Impeccable craft guidance. The older palette, two-column layout and system display type are historical defaults, not constraints on the redesign. Preserve AegisPay, product truth, all evidence/privacy rules and the exact submitted URLs. Do not migrate the selected Next/Node/Postgres architecture or require a new UI framework.

The public surface should make a specific useful task, bounded authority and independently verified receipt understandable immediately. Commit to an authored visual identity: distinctive self-hosted display typography, strong composition, an expressive integration/evidence graphic and restrained stateful motion, with a legible operational console. Choose color and light/dark treatment for actual projector/desktop/mobile use; no generic equal-card feature wall, decorative fake financial metrics or effects that imply fresh historical execution. Public recorded-proof mode stays explicit; full live actions depend on real backend gates.

Magic UI and Watermelon UI are current component/pattern references, not a mandate to install every effect or add dependencies. Use licensed source responsibly. Motion must respect reduced-motion settings and carry meaning through state transitions. Verify rendered output at 320/390px, tablet, desktop and 1280×720; all identifiers remain accessible without horizontal document overflow. TASK-014 owns the independent public redesign; TASK-008 still owns the backend-integrated product console after TASK-006.

**Status:** proposed MVP UI. No existing brand assets or rendered Figma file were supplied. Tokens below are explicitly chosen defaults, not transcribed from a codebase. Last specified: 2026-11-07; implementation sync pending TASK-008.

## Design principles

Make evidence visible. Keep financial state and available actions unambiguous. Show one primary action per section and preserve context when a transaction waits. Use text plus color for status and a persistent Testnet/demo banner. Prefer an understandable state table to visual effects.

## Component inventory

`TestnetBanner`, `WalletStatus`, `BalanceCard`, `PolicyForm`, `FundingForm`, `OfferTable`, `TaskInput`, `RunTimeline`, `AttemptStatus`, `ReceiptDetails`, `ClaimPanel`, `SafeError`, `EvidenceLink`. Use native inputs/buttons/tables with lightweight Tailwind styling. No component-library migration or animation system is required.

## Tokens

**[assumption] Defaults:** light background `#f8fafc`, panels `#ffffff`, text `#0f172a`, muted `#475569`, primary `#1d4ed8`, success `#166534`, warning `#92400e`, error `#b91c1c`, border `#cbd5e1`. System sans body and monospace hashes; 16px base text; spacing scale 4/8/12/16/24/32px; 8px panel radius. Validate actual rendered contrast, particularly disabled controls; no claim of audited accessibility.

## Patterns & states

Routes: `/login` and `/` console. Console tabs/anchors: Policy, Run, Merchant, Audit. Overview is the header balance/health strip. Role gating hides unauthorized controls but API enforces it independently. Desktop uses a compact two-column main/evidence layout; narrow screens stack panels.

Every asynchronous panel has idle/loading/success/refused/pending/unknown/unavailable states. `Unknown` retains operation and observation controls. “Refresh status” only observes. Start/Pay/Fund/Claim disables on a pending matching operation to reduce accidental retries; correctness still comes from DB constraints. Empty audit explains no confirmed purchases yet and never seeds fake successful transactions.

Model rationale is a brief stated choice, not an internal reasoning dump. Expose current offers and quoted snapshot side by side when price changes. Show configuration, chain-observed amounts and unavailable values distinctly; numeric metadata follows [methods](methods.md).

## UI voice & copy rules (enforced)

- INV-001: never call changed resource price the accepted invoice amount. Show “Current offer” and “Accepted quote” separately.
- INV-002/INV-004: never label preflight, simulation, sponsor reservation or `submitted` as “Paid.” Use “Authorized in escrow” only after the evidence gate.
- INV-003/INV-006: never promise a receipt unlocks “all reports.” Display the precise resource and validity window.
- INV-005: never say “Failed—pay again” for a timeout. Use “Status unknown; checking saved operation.”
- INV-007/INV-008: ban “Unlimited safety,” “Daily on-chain budget,” “Unhackable agent” and “Prompt-proof spending.” Show per-payment cap, finite escrow and application task ceiling separately.
- INV-008: label actual RPC simulation denial “Live contract simulation refused”; label an included failed transaction only when a ledger hash/result exists.
- INV-009: ban “Merchant settled” for authorization. Keep “Authorized in escrow” and “Claimed by merchant” separate. No Velo checkout success toast unlocks a report.
- INV-010: no automatic retry-payment CTA for unknown submissions. A diagnostic harness is not a public “bypass policy” button.
- Global: ban “Production ready,” “Audited,” “x402 compliant,” “Guaranteed instant” and “Fee free.” Use “Testnet demo,” “HTTP 402-inspired” and measured latency/fee only.

**Defaults overridden:** runtime is Node for all SDK-backed routes; no static caching/prefetch of protected reports; no framework auto-generated success UI substitutes for ledger evidence.

## Accessibility standards

Target keyboard use, visible focus, labeled inputs, semantic tables, status text in a polite live region and WCAG AA contrast. Avoid focus jumps during polling. Long hashes wrap with copy buttons that announce completion. Manual keyboard and screen-reader smoke checks remain part of the demo gate; formal conformance certification is out of scope.

## Key screen specs / wireframes

**Policy:** connected owner wallet and verified network/contract links; device and agent; cap/expiry form; escrow top-up; revoke then reclaim controls. Explain that setup requires human signatures. Display observed ledger/time next to chain values.

**Run:** task box and Start, current offers, activity timeline, highlighted accepted quote, safe pending/unknown status and final cited report answer. View receipt exposes transaction identities and resource scope. No browser field supplies payment amount or merchant to the worker.

**Merchant:** two public metadata rows with price edit; 402 challenge preview shows terms only; pending amount and wallet-signed claim. Private reports remain behind the normal entitlement path.

**Audit:** filter by run/attempt; quote ID, operation ID, Velo reservation, inner hash, outer hash, event/ledger, authorization state and separate claim list. Copy only safe IDs/hashes. Unknown fee shows “Unknown.” Recordings are visibly marked “Recorded Testnet run” with timestamp and evidence reference.
