# AegisPay finals UI and demo audit

Assessed 9 November 2026, approximately 07:15–07:23 UTC, against local main `180a88d` and the actual public site. This is a read-only assessment; no application source, canonical document, task state, branch, dependency, deployment, credential or chain state was changed. Only this report and `ui/` artifacts were written.

**Verdict:** the live site is a credible evidence viewer, but it does not yet communicate or demonstrate a complete agent purchasing product. Keep its unusually good honesty about saved proof. Give that proof a clear human story, an allowed-versus-denied comparison, and a receipt that can be understood before reading hashes. Visual polish will help the five-minute pitch; it cannot substitute for the unfinished model/payment/recovery/application gates.

The organizer email naming AegisPay Top 15 is user-supplied selection evidence. It supports presenting as a selected finalist, subject to the exact wording of that email; it supplies neither a winning guarantee nor a confirmed finals date or venue. This UI audit did not independently verify the email.

## Evidence and limits

Preserve the public name **AegisPay** and these exact submitted destinations:

- Website: https://aegispay-live.vercel.app/
- Pitch: https://github.com/slvdrvncntjvr/AegisPay/blob/main/docs/submission/AegisPay-pitch-draft.pdf
- Submitted video folder: https://drive.google.com/drive/folders/1hqwzOaG_qU9axjcLIjBUb1YeMWdOFq72?usp=sharing

Observed: production page and all three tabs; desktop 1440×1000, projector-sized 1280×720, mobile 390×844; keyboard focus/Enter/ArrowRight; repository, pitch, health and transaction links; actual screenshots opened and visually inspected. Browser observations are in [browser-observations.json](ui/browser-observations.json) and [rendered-details.json](ui/rendered-details.json). Browser clicks and public GET navigation only; no wallets, protected reports, signing or payment actions were exercised. Explorer pages were re-observed, not a rerun of the independent payment verifier.

Read: AGENTS, index, complete implementation plan, ledger, [UX specification](../design-system.md), [final saved checkpoint](../submission/final-checkpoint.md), [delivery status](../submission/delivery-status.md), web page/console/layout/CSS and [public proof constants](../../apps/web/src/lib/public-proof.ts). The newest checkpoint is essential: older docs and the deck describe workspaces/database/public assets as absent even though later work exists. The checkpoint still explicitly leaves the durable SDK worker, complete purchasing loop, authenticated product console, wallet/browser release evidence and complete hosted backend unfinished. One non-financial Gemini tool round trip is not a model purchase.

The local PDF has eight pages. Text was inspected throughout; pages 1, 3 and 8 were rendered and visually inspected ([premise](ui/deck-page-1.png), [choices](ui/deck-page-3.png), [progress](ui/deck-page-8.png)). This is not an inspection of every rendered page or of the submitted Drive video's playback. Another assessment should own complete media readiness.

Tool limitations and recovered failures:

- Orca version-matched CLI/browser guides were read. Its quoted element clicks returned success with the page unchanged; a DOM click changed Policy. The first unquoted `@e4` PowerShell argument failed with `--element requires a value`; quoting repaired argument parsing but did not resolve the click result. These are not evidence that the site's tabs are broken.
- Orca mobile evaluation gave an expanded width near 598px and screenshot geometry was unreliable for the desktop viewport. Installed Playwright was therefore used to independently capture and exercise the actual URL. No browser or package was installed: existing Chromium executable `chromium-1248`, reporting `156.0.8078.4`, was used through installed `@playwright/test`.
- The initial Python PDF text print failed with a Windows `UnicodeEncodeError` on an arrow. Repeating with `python -X utf8` succeeded and generated the PDF images.
- Linear's first short-wait screenshot captured only navigation. A later loaded capture and product-section capture succeeded. The web-fetch tool could not open `linear.app/docs/issue-views`; no findings rely on that failed page.
- These are targeted UI observations, not QA release gates, a full WCAG audit, performance certification, or new chain evidence. No screen reader, real touch device, wallet extension, browser restart recovery or backend purchasing journey was tested.

## What a judge sees today

| Surface | Observed strengths | Observed friction and implication |
|---|---|---|
| First screen | Product name is large; calm light background; clear Testnet language; no fake live-agent CTA | The first explanation requires understanding Noir, Velo, Stellar, authorization and simulation. There is no concrete task, offer or report outcome. The main action is effectively reading a technical record. |
| Run | Amount, nonce, parties, fee, observation time, authorization and claim are present | Green states appear side by side without the chronology that distinguishes authorization from collection. Long account strings compete with the purchase amount. There is no model/tool timeline or protected-resource result. |
| Policy | Cap, funded escrow, expiry and deployed contracts are exposed; refusal explicitly says simulation-only | Only stroops are shown for cap/funding. Expiry is 7 Nov, already past at this audit, without an explicit “Historical policy; expired” badge. Contracts occupy space before explaining the actual spending rule. |
| Audit | Correctly distinguishes hash roles and two balance snapshots | Classification and repository-relative evidence path are plain technical text. The evidence file is not a clickable verification source here; no copy buttons or focused receipt summary. A balance table would make the same facts easier to compare. |
| Navigation | Policy/Run/Audit clicks work in Playwright, with no page errors observed | Names are generic. Run opens first but contains no run action. Switching tabs does not encode selection in the URL; reload returns to Run. The refusal and authorization cannot be compared without switching. |
| External links | Repository and exact pitch destination opened successfully; Health JSON showed `{"status":"ok","network":"testnet"}` | The PDF link includes a raw repository path in its visible label. Health is a developer diagnostic presented at the same level as the pitch. There is no video entry point on the page. |

See [desktop Run](ui/desktop-run.png), [Policy](ui/desktop-policy.png) and [Audit](ui/desktop-audit.png).

**Immediate comprehension:** an engineer can infer “bounded spending backed by real Testnet proof.” A non-specialist judge is unlikely to infer within ten seconds who buys what, why an agent needs the purchase, what was refused, or what the product delivered. That is a design judgment, not a measured user-study result. The strongest existing message is in the deck: letting the agent choose useful data while keeping authority bounded. Bring that message into the website.

**Five-minute demo friction:** at 1280×720 the panel begins at approximately y=392; transaction links fall below the first viewport ([projector capture](ui/projector-1280x720.png)). The presenter must scroll and switch tabs to tell one story. At 390×844 the Run panel begins around y=623 and the first amount appears around y=800 ([first mobile viewport](ui/mobile-first-viewport.png)); almost the entire first screen is introduction and repeated qualification. The current site can support a narrated proof review. It cannot substantiate “watch the agent buy this report now.”

## Typography, layout, accessibility and mobile

The current 16px system sans body is readable on a monitor. The 1080px content width, modest radius and blue links are coherent. Underlines and text labels reduce reliance on color. Body/muted text and major controls have strong contrast; calculated solid-color pairs include muted `#475569` on white **7.58:1**, primary `#1d4ed8` on white **6.70:1**, warning `#92400e` on `#fff7ed` **6.68:1**, and actual status text `#475569` on `#dcfce7` **6.90:1**. These sample calculations do not cover every composited gradient/focus/hover state or certify conformance.

The hierarchy needs work. Values are generally about 14px bold monospace, including human-readable states, dates and fees. Monospace makes everything feel like diagnostics and is too small for a room-sized projection. Reserve it for identifiers and exact integer units. Use larger proportional numbers for cap and amount; make status a compact, content-sized badge rather than a full-width pale green bar. Current `.row span` specificity makes status text muted slate instead of the intended success green; contrast remains sufficient, but the token behavior is inconsistent.

The brand is a paragraph and the rendered page has **no h1**. Tabs have roles and selection state, but no IDs/`aria-controls`; panels have no `aria-labelledby` association. All tabs are `tabIndex=0`. Focusing Policy and pressing ArrowRight left focus on Policy and selection on Audit; Enter then selected Policy. Visible focus is present ([capture](ui/keyboard-focus.png)), and native button activation works. Implement the expected tab keyboard model and associations, or use simple section navigation without tab roles. The [W3C tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) provides the relevant behavior. Tab buttons measure roughly 60–73px wide and 40.4px high; use 44–48px heights as a practical touch design target, without claiming that their current height alone proves a WCAG failure.

**Confirmed mobile defect:**

| 390×844 mobile context | `clientWidth` | `scrollWidth` | Result |
|---|---:|---:|---|
| Run | 390 | 597 | 207px overflow; transaction hash links extend beyond the card |
| Policy | 390 | 390 | No horizontal overflow observed |
| Audit | 390 | 390 | No horizontal overflow observed |

[Full Run screenshot](ui/mobile-run.png) visibly exposes the overflowing links. Compare [Policy](ui/mobile-policy.png) and [Audit](ui/mobile-audit.png). Production `.list a` computes to `overflow-wrap: normal`, while the current local stylesheet declares `overflow-wrap:anywhere`. This supports a deployed/local CSS difference; it does not prove the exact deployment commit. Do not treat the earlier local repair as a production pass. Measuring `innerWidth` alone would have missed it because the mobile Run visual/layout viewport expanded to about 597px.

Audit's current `word-break:break-all` also breaks ordinary prose such as hash-role descriptions mid-word. Wrap machine identifiers anywhere; wrap human text normally. Preserve full identifiers through accessible copy/reveal controls. A shortened display with a complete accessible label and exact link target is appropriate; silently dropping full identities is not.

## Proof language and trust

Keep these existing good distinctions: recorded spike versus autonomous model purchase; simulation refusal versus included failed transaction; escrow authorization versus merchant claim; inner versus outer/event hash. There are no observed fake payment, retry, wallet or report controls in this public slice.

Improve the following before finals:

1. Replace repeated disclaimers with a persistent compact mode label and one concise scope explanation. Repetition currently consumes attention without adding evidence.
2. Label the historical record with a date wherever it appears. “Live contract simulation refused” describes a real past RPC simulation, but on today's read-only page it can imply a fresh check. Prefer **“Recorded contract simulation · 7 Nov 2026”** and **“Denied before submission”**, followed by the precise error in details.
3. Mark the displayed policy **“Historical policy · expired 7 Nov 2026, 15:32 UTC”**. Do not imply that this saved configuration can authorize a new purchase today.
4. Link the public redacted evidence file from the receipt. A Stellar explorer success is useful corroboration, not the complete Noir/Velo independent verification. Do not label a mere explorer link “verification passed.”
5. Keep the saved spike's resource/quote/model fields **“Not established by this spike”** when absent. Do not retrospectively call the saved 0.03 XLM authorization a QuickSignal purchase or a delivered report. QuickSignal and DeepTrace are intended fixture scenarios in the deck, not observed product execution.
6. Health JSON establishes web endpoint availability. It does not establish a working payment worker, database, model, current policy or backend readiness.

Safe link exercise confirmed three explorer pages opened. The outer and inner authorization links both displayed the same successful outer transaction context with an inner reference, ledger 5607680. Claim displayed a separate successful transaction, ledger 5607763. Explain this relationship in the UI; two auth URLs are not two payments. These are public explorer observations only, not fresh envelope/invocation/event matching. Existing proof amounts and hashes were preserved.

## Reference research: patterns to adapt

Primary product pages were searched/opened on 9 Nov and captured from their actual websites. These are public marketing/product demonstrations, not authenticated access to private customer dashboards.

| Inspected reference | Specific useful pattern | Adaptation for AegisPay |
|---|---|---|
| [Stripe Payments](https://stripe.com/payments), [screenshot](ui/reference-stripe.png) | Clear outcome headline beside a concrete checkout with a plan summary and amount; one dominant CTA and a quieter secondary action | Put task, price and decision in the same visual frame. Show accepted amount once, prominently, with technical units below. Adapt the information hierarchy rather than Stripe's gradients or sales claims. |
| [Linear](https://linear.app/), [loaded hero](ui/reference-linear-loaded.png), [product section](ui/reference-linear-product.png) | Persistent context at left, readable activity in the center, detail/work panel beside it; restrained borders and clear selected context | Keep spending rules visible while a task trace progresses. Selecting a trace step should reveal its quote/receipt evidence without leaving the screen. Retain AegisPay's warmer identity instead of cloning the dark theme or copying its enterprise navigation. |
| [LangSmith Observability](https://www.langchain.com/langsmith/observability), [screenshot](ui/reference-langsmith.png), [official observability concepts](https://docs.langchain.com/langsmith/observability-concepts) | Behavior is made inspectable through a hierarchy of operation and individual steps; high-level comprehension and technical detail serve different reading speeds | Offer an ordered task/tool/payment trace with expandable step details. Make financial permission and independent verification explicit events. Avoid metric dashboards with invented run counts, success rates, latency or spend history. |

The website need not become a broad marketing site. Its immediate audience needs one memorable proposition and one inspectable demonstration. These references support that specific redesign direction; they do not establish AegisPay features or market demand.

## Proposed polished direction

**Direction:** a calm agent purchasing workbench, visually continuous with the existing deck. Keep the submitted URL and name. Use a light work area, dark teal identity, mint success accents and clear evidence provenance. The existing shield in the deck is enough brand material; a rebrand or decorative asset campaign is unnecessary.

### Exact copy and navigation

Navigation: **AegisPay** at left; **Demo**, **Policy**, **Evidence** as page anchors; **Pitch deck** and **GitHub** as secondary external links. Keep the existing submitted pitch destination byte-for-byte. Put Health JSON in the developer footer. Add **Submitted video** linking to the exact existing Drive folder only with an honest folder label; label a playable recording directly only after playback/public access is verified.

Hero eyebrow: **“Agent payments · Stellar Testnet”**

Hero h1: **“Let agents buy useful data. Keep spending within your rules.”**

Hero body: **“AegisPay separates the agent's intent from payment authority. Noir enforces policy limits; Velo sponsors and submits the authorization; independent evidence checks confirm what happened.”**

Current-mode badge: **“Recorded Testnet proof · 7 Nov 2026”**

Current-mode scope line: **“One real authorization, one separate merchant claim, and an unsigned over-cap simulation. The complete model purchasing app is still being built.”**

Current primary CTA: **“Explore the verified proof”** — moves to the saved evidence workbench, with no payment side effect. Secondary: **“View pitch deck”**. No button may imply that a new model purchase is runnable today. Once the full product gates pass, a separate explicitly selected live mode may offer **“Run task on Testnet”**; that is a future application capability.

### Three-column demo workbench

This is a proposed screen layout, not an implemented backend or a relabeling of the saved spike:

| Left: Rules, 280px | Center: Task and decision, flexible ≥400px | Right: Receipt and proof, 340px |
|---|---|---|
| Mode, network, historical/current policy status | Human task or clearly labeled intended example | Selected attempt's financial state |
| Per-payment cap, expiry, asset, funded escrow | Offer/accepted quote summary when actually available | Amount, merchant, quote/resource scope when evidenced |
| Separate application task ceiling, only if configured | Ordered trace: intent → quote → policy → dispatch → verification → delivery | Velo result and independent evidence checks |
| Compact identities; expandable contract details | Allowed/denied scenario navigation with provenance on each | Authorization and separate claim timeline |
| No duplicate setup signatures during a pitch | Result answer only after real entitlement | Explorer, evidence, copy/reveal safe IDs |

At desktop widths ≥1180px use a maximum content width of 1440px, 32px page gutters and 20px column gaps. At intermediate widths retain rules as a compact strip above task/receipt columns; at mobile stack **task/decision → receipt → rules** with a compact cap/mode strip at top. No horizontally scrolling three-column canvas on phones. Keep a summary of mode, amount, cap and result within the first viewport. For the pitch add a compact presentation view: navigation 56px, mode 28px, summary around 100px, then the workbench; target the key decision and proof summary fitting at 1280×720.

**Current proof mode:** center shows “Configured SDK authorization,” the amount, and the actual recorded sequence. The denial scenario shows the saved simulation record. Missing quote, resource delivery and model choice stay explicitly absent. Clicking between scenarios replays/view-selects evidence and must not fabricate a second payment. Proposed fixture task/offer examples can be explained in a separate **“Intended workflow · not executed”** region.

**Future live mode:** only after actual gates, center may contain a task input and real tool/quote trace. An example task is “Find the lower-cost report that answers this research question within my budget.” Display only the model's brief stated choice and tool actions, never private reasoning or keys. Current offer and immutable accepted quote remain separate if pricing changes. Report content must come through the authenticated entitlement path, not hardcoded into a public demo component.

### State and receipt design

Use two separate tracks: **purchase authorization** and **merchant collection**. A green authorization badge must not imply that a merchant already collected. Keep resource entitlement status separate as well.

| State | Exact user-facing core | Evidence/action rule |
|---|---|---|
| Ready | “Ready to request a quote” | Future product state only; no implied payment |
| Quote accepted | “Quote accepted · [amount] · [resource]” | Real immutable stored quote; no client-supplied replacement terms |
| Refused | “Denied before submission” | State the failed check. For the saved refusal: “Recorded contract simulation; nothing signed or submitted.” |
| Submitted | “Submitted · awaiting confirmation” | Saved operation/reservation identity; no success or report unlock |
| Unknown | “Status unknown · checking the saved operation” | One observation action, “Refresh status”; no Pay again/retry-sign action |
| Authorized | “Authorized in escrow” | Real successful Velo result plus matching envelope/invocation/event evidence |
| Entitled | “Access verified for [resource]” | Only after real owner/quote/resource entitlement checks; absent in current spike |
| Claimed | “Claimed by merchant · separate transaction” | Separate claim proof; never count as another purchase |

Receipt summary: **0.03 Testnet XLM** (secondary `300000 stroops`), authorization state, timestamp, merchant, and an explicit “Recorded” badge. Detailed section keeps operation ID, Velo reservation when publicly safe/available, nonce, inner authorization hash, outer fee-bump hash, event mapping and claim hash as separate labeled rows. Actual fee is **0.0082496 Testnet XLM / 82496 stroops**, labeled as a historical matched fee, not a current quote or general cost promise. Link text should say **“Open authorization transaction”**, **“Open inner authorization”**, **“Open separate claim”** rather than presenting three raw hash paragraphs.

Verification checklist can say “Recorded verification matched” only from the saved trusted verifier result, with evidence link and observation date. A fresh live check should display its own observation time only when actually performed. A balance table should show escrow and merchant-pending before authorization, after authorization, and after claim. Show “Unknown” rather than zero for unavailable values. All copy controls announce completion; they copy safe IDs, never keys or signed XDR.

### Palette, type and spacing

Reuse the deck's tokens where practical: ink/dark teal `#172c31`, paper `#f4f2e9`, white panels, muted `#566768`, mint `#bcebd5`, success/primary green `#27654c`, subtle border `#cbd3c9`. Use amber only for pending/history (`#92400e` on pale amber); red `#b91c1c` on pale red for refusal/error. Give historical provenance a neutral clock icon plus text so amber does not imply a broken payment. Ink on paper is approximately **12.99:1** and green on white **6.88:1**; validate the rest during implementation.

Use one body/display family, initially Segoe UI/system sans to avoid a font-loading dependency. 16px/24px body, 14px/20px supporting text, 20px/28px panel headings, 32px/40px amount, and 44px/48px desktop hero (32px/36px mobile). Use 13–14px monospace only inside expandable identifiers and exact integer units. Presentation view should promote important copy to 18–20px and amounts to 36px. Never shrink receipt essentials to make every hash fit.

Spacing scale: 4/8/12/16/24/32/48px. Panels 16–24px padding, 12px radius, 1px borders, minimal shadows. 44–48px controls, visible focus, stable layout while observing. Animation, if any, should be restrained and respect reduced-motion preferences. Do not animate a historical record as if chain work is occurring now.

## Prioritized implementation checklist for the coordinator

These are recommendations for a later authorized implementation task. This assessment changes no task statuses or product scope.

| Priority | Change | Concrete acceptance |
|---|---|---|
| P0 | Repair production Run overflow using the existing local wrapping intent, then verify the exact alias | At 390px, each tab has `scrollWidth <= clientWidth`; screenshots show complete readable links/IDs; no `overflow:hidden` concealment. Repeat at 320px and tablet widths. |
| P0 | Correct historical/current labels and policy expiry | Every saved view carries date/mode; expired policy is explicit; simulation is not an included failure; no live-model/purchased-report implication. |
| P0 | Reconcile deck/site claims against newest actual checkpoint | Refresh content at the same pitch path. Remove false “missing public app/deck” and outdated absent-workspace/database claims while retaining incomplete full-app and release gates. Match selection wording to the supplied organizer email. |
| P0 | Establish a reliable five-minute proof path | At 1280×720, amount, cap, allowed/denied distinction and proof summary are legible without hunting through tabs; rehearse an honest saved-proof fallback. |
| P1 | Replace raw field grid with task/decision/receipt workbench | A new viewer can identify who wants what, permission decision and evidence scope within ~10 seconds in a small user check. Stored spike facts are not promoted into missing model/resource evidence. |
| P1 | Fix headings and tab semantics; add accessible safe copy/reveal controls | One h1; working ArrowLeft/Right, Enter/Space and focus order; valid panel associations; announcements; visible focus and labeled links. Manual screen-reader smoke remains required. |
| P1 | Link redacted evidence; show chronology and amount units | Inner/outer/event mapping and separate claim are clear; balances compare in a table; XLM and exact stroops agree. No fake live refresh or synthetic success checks. |
| P1 | Finish and verify actual backend-dependent demo before enabling live CTA | Real authenticated model → accepted quote → guarded payment → independent proof → correct entitled report, plus denied/unknown behavior. This is existing unfinished product work, not a CSS feature. |
| P2 | Unify deck and site tokens; simplify header/footer destinations | Same name, palette, terminology and submitted URLs; Health is secondary; video destination verified before claiming playback. |
| P2 | Complete responsive/accessibility/rehearsal checks | Real phone, keyboard, screen reader, reduced motion, zoom/reflow, long IDs and empty/pending/unknown states; projection rehearsal from the exact deployed build. |

The best finals direction is a compact, credible purchasing demonstration whose evidence can be opened immediately. A second decorative landing page, invented financial metrics or a simulated autonomous success path would weaken that credibility. The current saved proof is useful and presentable if described precisely; the end-to-end product must earn its live label through actual completion and evidence.
