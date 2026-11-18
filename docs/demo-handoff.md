<a id="use-the-hosted-aegispay-testnet-demo"></a>

# Use the hosted AegisPay Testnet application

Open **[aegispay-finals-app.onrender.com/login](https://aegispay-finals-app.onrender.com/login)**.

Select **Owner** or **Merchant** and use the existing corresponding login token from the protected local file `.fmd-work/release-setup/hosted-access.md`. The tokens are unchanged. This file is ignored by Git and restricted to the local user; never paste it into chat, source control or a presentation. The same role selector lives at the hosted login page.

## Current state

The real Gemini-driven QuickSignal purchase completed, delivered its report and created one independently verified receipt. Its separate human-signed merchant claim paid0.03TestnetXLM. These original records, identities, hashes, fees, timestamps, events and nonce1 are on the hosted database. At the last verified checkpoint, owner escrow was0.07XLM and merchant pending0. Future QuickSignal price was set to0.04XLM; the paid quote stays0.03XLM.

The old report's15-minute access window has expired. Receipt metadata and history remain available; reopening a receipt never extends paid access. This is expected behavior, not a missing migration. The original unrelated historical incident remains in its separate context and is not silently resolved by this deployment.

## Normal use

The owner can view Policy, Run and Audit; the merchant can view Pending, Offers and Claim. Use **Refresh chain observation** for current balances. The role-appropriate Freighter account must be selected on **Stellar Testnet**:

- Owner: `GAXQOA4O5YZHOXJP2TFDOA6RFKL3UXVUH3XGFEL3GMGBM3V32FRENZS7`.
- Merchant: `GAD7HS6DXSAZG7LQRXJWGK322LORGCI2BZP5S3TQ75ATWLJQKKRTXCHK`.

Before a new purchase, renew the expired owner policy through **Set finite policy**, cap up to1000000integer stroops, with expiry within the next hour. Prepare, review and sign in Freighter, then check the saved operation. This is ordinary spending consent; no additional test purchase or setup replay is required. Keep the existing escrow: the initial lifetime funding authority was already consumed, so spend/reclaim does not permit a top-up in this context.

Starting a task supplies fresh purchase intent under the displayed prices and finite run/policy/escrow ceilings. If its payment is unknown, observe the existing identity and wait; never create another purchase to replace it. Authorization credits merchant-pending escrow; claiming requires a separate merchant signature. Owner revocation/reclaim controls remain available with their server checks, but their remaining live qualification is deferred.

## Hosting and custody

The hosted web, authenticated worker and PostgreSQL database are the active copy. The old local3019/3020 processes are retired and the local database is read-only; closing Orca or Docker does not stop the hosted application. The prior saved-proof site and authenticated preview are unchanged.

Both services use Render Free instances and can take time to wake after inactivity. The new Free PostgreSQL database expires **December14,2026**. Preserve/export the current hosted history before that date or move to durable database hosting; never resume from an older nonce snapshot after new payments. The protected native cutover backup is `.fmd-work/release-setup/demo-delivery/source-complete.dump` and is a point-in-time backup, not a continuously updated copy.

This is the user-selected **Testnet application** handoff. The verified core transaction was performed locally and its exact history moved to the hosted runtime; hosted login/security/state checks created no new payment. Mainnet use and broader production qualification are not claimed. No further rehearsal is required for this handoff. [Delivery evidence](evidence/demo-delivery-2026-11-15/report.md) records exact deployment and cutover checks; the [QA plan](qa-test-plan.md) retains deferred broader release qualification separately.


## Presentation refresh — 18 November 2026

The existing login and public proof URLs now serve the cleaned presentation, and the README/docs/PDF are published at their original paths. Finals web source is a60798a; the worker remains at d42cb96 with its same deployment/configuration, and database configuration is unchanged. Anonymous GET-only checks created no session or financial handoff; no stored history/report window was rewritten. [Publication evidence](evidence/product-presentation-2026-11-18/publication.md) records the actual IDs and readback.
