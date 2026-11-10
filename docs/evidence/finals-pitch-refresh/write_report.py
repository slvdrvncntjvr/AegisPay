from pathlib import Path
import hashlib,json,datetime
root=Path('docs/evidence/finals-pitch-refresh');g=json.loads((root/'final/pdf-gates.json').read_text());b=json.loads((root/'final/presenter-gates.json').read_text());links=json.loads((root/'final/link-readback.json').read_text());old=json.loads((root/'before/old-pdf.json').read_text())
(root/'OFL-Bricolage-Grotesque.txt').write_bytes(Path('apps/web/public/fonts/OFL-Bricolage-Grotesque.txt').read_bytes())
sources=['docs/evidence/finals-ui/task-014.md','docs/evidence/finals-proof-deployment/task-015.md','docs/evidence/finals-payment/task-005.md','docs/evidence/finals-payment/actual-testnet-unresolved-checkpoint.json','docs/evidence/finals-payment/actual-read-only-observation-1794217180681.json','docs/evidence/finals-payment/actual-velo-status-1794217433978.json','apps/web/public/fonts/bricolage-grotesque.woff2']
source_rows='\n'.join('| `'+p+'` | `'+hashlib.sha256(Path(p).read_bytes()).hexdigest()+'` |' for p in sources)
page_rows='\n'.join(f'| {r["page"]} | {r["title"]} | {r["characters"]} | {r["links"]} | 0 | Passed |' for r in g['pages'])
link_rows='\n'.join(f'| [{r["url"]}]({r["url"]}) | {r.get("status",r.get("error"))} |' for r in links)
report=f'''# TASK-016 — submitted pitch refresh

**Local deliverable succeeded, 9 November 2026; publication remains coordinator-owned.** Refreshed the actual eight-slide HTML, Markdown and PDF at the exact submitted filename. Work ref: Orca `run_3bfef6dba661`, task `task_777014f3f047`, dispatch `ctx_8774f8dc713f`, local main base `180a88d`. Sole presentation writer; no helpers, Git mutations, app/backend/env/package changes, payment/provider/model calls, new chain verification, upload or organizer contact. The original app preview on 3017 was untouched.

New PDF: **{g['bytes']} bytes**, eight **960 × 540 point (16:9)** pages; SHA256 **`{g['sha256']}`**. Exported and inspected at {g['observedAt']}. The earlier Nov 7 submitted file was **{old['bytes']} bytes**, SHA256 **`{old['sha256']}`**; that remains a historical fact, not the new file identity. An interim Nov 9 render had SHA256 `d21c12af0fe6fdc6f99582c8b05be9726a6dc0e4ac0df4d5f9cd93c16bcff749` and was superseded after coordinator editorial review.

## Editorial result

A concrete release/dependency-triage assistant gives paid specialist data a reason to exist. The fictional demo-parser/QuickSignal/DeepTrace scenario is visibly hypothetical and unexecuted. The story proceeds from task → usefulness and price → same-authorization integration → human receipt → observed unresolved hold → proposed developer/provider pilot → next measurable milestone. One main idea per slide, varied editorial layouts and large 55–82px titles replace repeated feature-card walls. Operational copy remains readable at 1280×720; technical identities move into exact clickable targets and this report.

Stale claims of missing workspaces, DB, UI, deployment and public links were replaced with the precise achieved/local/open boundary. Slide 1 says **PREPARED 09 NOV 2026**, not a confirmed finals date. Supplied Nov 8 email names Top 15; finals date/venue remain TBA. Handbook working format is five minutes plus three-minute Q&A, criteria 30/25/20/15/10. No obsolete deadline caveat is foregrounded. No official rules/date, customer, revenue, market size, security audit, mainnet, x402 conformance, zero-knowledge proof or new purchase success is invented.

Speaker notes are **600 words**, scheduled **25 + 35 + 45 + 45 + 40 + 40 + 35 + 35 = 300 seconds**. The allotted pace is 120 words/minute overall, allowing pauses by speaking near 130 words/minute; this is a prepared clock, not a claimed stopwatch rehearsal. Use the receipt and unknown-state slides for brief pointing/reading pauses. Q&A keeps the detailed test/transport, exactly-once, Gas interpretation and tooling limitations outside the spoken hero narrative. Notes are identical in HTML and Markdown and absent from PDF.

## Deployment

This worker independently opened **https://aegispay-live.vercel.app/** anonymously with installed Playwright/Chromium on Nov 9, observed HTTP **200**, its actual title and body, captured and viewed [public-site.png](public-site.png), and inspected TASK-015's real production desktop/receipt captures. [Own public readback](public-site.json) records **2026-11-09T10:59:43.957Z**. The web-reader tool failed to access the site; the actual browser recovered access. The screenshot is an unaltered browser capture of the production proof viewer, not a fabricated product mockup. It contains public historical evidence/fixture metadata, no purchased report body. No screenshot is shrunk into the deck; the deck uses authored diagrams and a human receipt.

TASK-015's report and provider readback identify the unchanged submitted alias, deployment **`dpl_FjfihhCpDKGCzrzxhTSvhHVb6jid`**, **READY**. TASK-014/015 are done per the coordinator's authoritative plan. The site is a **public recorded-proof viewer**, not the authenticated purchasing product, fresh policy-health check or full TASK-012 release. The historical policy expired Nov 7, 15:32 UTC.

## Application attempt

The Nov 9 application attempt has **one persisted financial handoff** and remains **UNKNOWN**. Its original quote is `2919ccca-2d31-4bc4-9140-649c8b1fc0ae`, attempt `f69178b7-0b0b-46fa-8e82-65c2dd5deee5`, operation `3ced1846-a7cd-4455-bb27-0b21a253f2c3`, reservation `3ef113f6-0bb4-449a-ac6a-29407adb4ee5`, inner hash `36f71d7ddee16271b6c23e73fa5ef1f1ca4f0e44e3d0a52ef6eca2115f80d0f8`. Reserved **300000**, application spent **0**, entitlement count **0**. Handoff was recorded at `2026-11-09T09:36:16.026075Z`. The final saved Velo status observation at `2026-11-09T09:43:53.977Z` returned **HTTP 409**; earlier independent RPC observation was **NOT_FOUND**. No success or definitive failure is inferred. Prior provider status `claimed` is not merchant claim or independent successful authorization.

This is an observed conservative unresolved hold, not a second success or a completed end-to-end recovery result. Original identity is retained for observation; no replacement financial handoff or report release is authorized. TASK-005 remains unfinished. Backend work stopped at the Orca retry breaker after quota/startup errors; no new backend task or financial call occurred here. One application handoff is a bounded design/observed property, not universal exactly-once execution or guaranteed liveness.

The **separate Nov 7 historical spike** proves one **300000-stroop / 0.03 Testnet XLM** authorization through the same Velo-sponsored signed Noir invocation, independently matched envelope/invocation/event, and **one separate merchant claim**. Escrow went **10000000 → 9700000**; merchant pending went **0 → 300000 → 0** after claim. Inner `1d39c3e3d7f400475aa2686f173a943346c5870635731fbd62fa41f1f912fa7a` and outer/event `6e898ad830e866f0831577849361739cea7ad03cfbfcee9febf0fc057633d381` map to that one payment. Claim `94cea8bb561576ab71d4419571b92bd2fe7d8eada1273ff16960a716160c9a18` is distinct. Actual **unsigned/unsubmitted contract simulation** refused **1200000 against 1000000**; no included failed transaction is claimed. Re-observation is not another purchase. This spike did not prove a model choice, QuickSignal purchase or report delivery. No payment test or chain observation was rerun by this presentation worker.

## Current sources

Read the dispatch, AGENTS.md, documentation index, implementation plan/ledger, pitch kit, finals pitch strategy, actual old HTML/Markdown/PDF, UI report and deployment evidence, backend report and redacted attempts. Rendered and individually viewed **every old PDF page before changes**; rendered and individually viewed **every final PDF page after all editorial changes**. Interim and final screenshot views are not substituted for inspection of the PDF renders.

Local sources inspected and SHA256 at refresh (provenance only; the following source reports are not required as new PDF annotation destinations):

| Existing local source | SHA256 |
|---|---|
{source_rows}

The backend owner's report records **64 PostgreSQL / 73 unit / 50 offline spike** passes. PostgreSQL locks/state constraints are real DB tests, while chain/provider transport in these tests is synthetic. Workspaces, quote/budget/nonce/evidence foundations, private auth/wallet APIs, worker source and Gemini adapter exist locally. Gemini previously completed only a harmless tool round trip. Those are attributed implementation/test reports, not executions by this worker, full model purchase acceptance, real report delivery or hosted release. Contract cap/expiry/finite escrow remain distinct from app task budget and quote/resource ownership. Event alone lacks asset/agent; independent matching remains necessary.

## Business hypotheses

Hypothetical customer: a small developer team building a release/dependency-triage assistant. Hypothetical supplier: a specialist report API willing to integrate one endpoint. Paid content might improve a task beyond free listing metadata; the pilot must establish that with repeat use. Reports/prices are fictional Testnet examples. Ask: one developer and one provider design partner plus technical feedback. No existing partnership, interview, customer or revenue is claimed. Provider gateway subscription or fulfilled-request fee is unvalidated; willingness to pay, actual costs and margins need measurement. Caps, isolated agent wallets and HTTP 402 are not unique. Credit Noir policy/escrow and Velo sponsorship/submission; AegisPay contributes exact composition/evidence mapping and the intended dependable resource workflow.

## Rendering and verification

Used unchanged `scripts/render-pitch-deck.mjs`, existing **Node 24.22.1**, exact **@playwright/test 1.65.0**, cached **Chromium 156.0.8078.4**, **PyMuPDF 1.26.4**. No installs, downloads, package migrations, server startup or renderer fix was needed. Export blocks external subresources; embedded Bricolage loaded successfully. Self-contained HTML requires no app server.

```powershell
python docs/evidence/finals-pitch-refresh/build_deck.py
$env:DECK_BROWSER_EXECUTABLE = Join-Path $env:LOCALAPPDATA 'ms-playwright/chromium-1248/chrome-win64/chrome.exe'
$env:DECK_CHECK_DIR = 'docs/evidence/finals-pitch-refresh/final'
node scripts/render-pitch-deck.mjs
python docs/evidence/finals-pitch-refresh/verify_pdf.py
node docs/evidence/finals-pitch-refresh/verify_browser.mjs
python -X utf8 tools/check-docs.py
python -X utf8 fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict
git diff --check -- docs/submission docs/evidence/finals-pitch-refresh
```

Final export: exit **0**, eight **1280×720** CSS slides, **zero** out-of-slide/footer-overlap violations, **zero** page JS errors, **20** external PDF annotations / **14** distinct full targets. [HTML layout](final/html-layout.json), [PDF gates](final/pdf-gates.json), [presenter controls](final/presenter-gates.json), [HTTP readback](final/link-readback.json). Expected titles, all footer page numbers, every text-span bound and every external annotation were checked. All four fixed destinations and all three exact historical hashes survive. Notes/Q&A/toolbar are excluded even when opened before print. No external subresource requests occurred. Notes button, N shortcut, Q&A open/close passed. Each of the eight PDF pages was rendered at 1280×720 and individually viewed: no clipped/overlapping text, missing glyphs, blank/extra pages or unreadable main content observed.

| Page | Expected title | Extracted characters | Link annotations | Out-of-page text spans | Visual result |
|---|---|---:|---:|---:|---|
{page_rows}

Exact distinct annotation destinations and anonymous prepublication HTTP result:

| Destination | HTTP |
|---|---:|
{link_rows}

The four **404** destinations are fragments of **this one new report**, not four missing external dependencies. They cannot return 200 before the coordinator publishes it. All ten other destinations returned **200**; current PDF 200 still refers to the old remote bytes until publication. HTTP 200 from an explorer does not reverify chain state; Drive folder 200 does not prove playback. Coordinator must publish this report with the PDF and verify all four anchors and new raw-PDF hash afterward. No remote success is claimed from local preparation.

Recovered preparation issues: an oversized initial Windows command was rejected before execution; wrote the generator in bounded file edits. Initial renderer correctly blocked two footer overlaps; layout was tightened and the unchanged guard passed. One scratch word-count read used Windows default cp1252 and failed; UTF-8/browser count recovered. First draft notes were **759** words; coordinator requested 600–650, final notes are **600**. The coordinator also reviewed all interim PDF pages, accepted visual direction, and requested the preparation-date/ask/evidence-link edits now incorporated. No failing layout was exported as final.

## Asset rights and screenshot provenance

Bricolage Grotesque is embedded from the project's existing WOFF2, originally sourced from `https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque`, under **SIL Open Font License 1.1**. Full license is included as [OFL-Bricolage-Grotesque.txt](OFL-Bricolage-Grotesque.txt); original app provenance attributes the font and lossless fontTools conversion. System Segoe UI supplies operational text through existing local fonts, with PDF font subsets emitted by Chromium. Authored HTML/CSS/SVG diagrams and small mark follow the existing project identity; no stock artwork, generated raster, new third-party UI library, copied handbook pages or competitor artwork is used. The production capture is of AegisPay's own public site, recorded by this worker as described above, and is evidence only.

## Staged publication handoff

No stage, commit, checkout, push, remote upload or publication was performed. Coordinator owns canonical status/README reconciliation, final rendered review and publication at the **same main path**: `docs/submission/AegisPay-pitch-draft.pdf`. Fixed public URL remains `https://github.com/slvdrvncntjvr/AegisPay/blob/main/docs/submission/AegisPay-pitch-draft.pdf`; website/repository/video-folder identities are unchanged.

Required self-contained publication set: the four scoped submission files `deck.html`, `pitch-deck.md`, `AegisPay-pitch-draft.pdf`, `deck-rendering.md`; this **task-016.md** (all four new evidence anchors); **OFL-Bricolage-Grotesque.txt**; **public-site.png/public-site.json**; and **final/** containing eight page PNGs, eight extracted text files, `html-layout.json`, `pdf-gates.json`, `presenter-gates.json`, `link-readback.json`. These are public-page captures, generated artifact checks and factual redacted provenance; no raw HTTP response dumps, signed XDR, credentials, receipt tokens, private report body, environment values or payment journal is included. Existing historical proof/verifier/PRD/source already returned 200, so no unrelated backend report publication is needed for PDF annotation resolution.

Optional reproducibility files in this directory: `build_deck.py`, `style.css`, `expected.json`, `verify_pdf.py`, `verify_browser.mjs`; `final_edits.py` is an already-applied historical transform and must **not** be rerun. `before/` is local comparison evidence and is not needed for publication. No changes to `scripts/render-pitch-deck.mjs` were made. Full application, wallet/model/resource/recovery and release gates remain open; local artifact completion does not complete TASK-012/013 or the live MVP.
'''
(root/'task-016.md').write_text(report,encoding='utf-8')
render=f'''# AegisPay pitch — rendering and verification

Refreshed **9 November 2026** under Orca `run_3bfef6dba661`, TASK-016. Actual edited sources: [deck.html](deck.html), [pitch-deck.md](pitch-deck.md), and [AegisPay-pitch-draft.pdf](AegisPay-pitch-draft.pdf). Public filename and submitted link are preserved. Publication is the coordinator's next action after review; this worker did not push.

The self-contained HTML uses the site's ivory/petrol/mint identity and embedded Bricolage Grotesque, licensed under [SIL OFL 1.1](../evidence/finals-pitch-refresh/OFL-Bricolage-Grotesque.txt). All diagrams and the receipt are authored HTML/CSS/SVG. No fabricated product screenshot, remote font or external subresource is loaded. Speaker notes total **600 words / 300 scheduled seconds** (25/35/45/45/40/40/35/35); N toggles notes, arrows navigate, Q&A opens presenter prompts. All controls and notes are excluded from PDF. Five-minute pitch plus three-minute Q&A is the handbook working format, not a newly confirmed finals schedule.

Used the unchanged [renderer](../../scripts/render-pitch-deck.mjs), Node **24.22.1**, installed exact Playwright **1.65.0**, cached Chromium **156.0.8078.4**, PyMuPDF **1.26.4**. No install or migration.

```powershell
$env:DECK_BROWSER_EXECUTABLE = Join-Path $env:LOCALAPPDATA 'ms-playwright/chromium-1248/chrome-win64/chrome.exe'
$env:DECK_CHECK_DIR = 'docs/evidence/finals-pitch-refresh/final'
node scripts/render-pitch-deck.mjs
python docs/evidence/finals-pitch-refresh/verify_pdf.py
node docs/evidence/finals-pitch-refresh/verify_browser.mjs
```

Final export: **8 pages**, each **960×540 points (16:9)**, **{g['bytes']} bytes**. SHA256:

```text
{g['sha256']}
```

Historical Nov 7 PDF: **{old['bytes']} bytes**, SHA256 `{old['sha256']}`. This historical hash does not identify the refreshed file.

Observed final checks: zero HTML out-of-slide/footer violations, zero JS errors, expected page titles/footers, zero PDF text spans outside page, **20 HTTPS annotations / 14 distinct targets**, all four fixed destinations and three full historical transaction hashes retained. Notes/Q&A absent from PDF. All eight final PDF page renders were opened and visually inspected individually after final editorial changes. Presenter notes/N/Q&A/print controls passed. Ten existing destinations returned 200; four fragment targets refer to the single new TASK-016 report and returned prepublication 404. Publish that report together with the deck and verify those anchors plus the new remote raw-PDF hash. Existing PDF URL returning 200 before publication still serves the old bytes. Drive destination remains a folder, with new MP4 upload/playback unverified.

[Complete TASK-016 report](../evidence/finals-pitch-refresh/task-016.md) records page-by-page results, exact destinations, command outcomes, current facts and limitations, font/screenshot provenance, recoveries and the safe publication allowlist. The successful historical Nov 7 authorization is distinct from the Nov 9 unknown/unentitled application attempt. Full model purchase/recovery/hosted release remain unfinished. No payment/chain/model operation or app test was performed for this artifact change; documentation checks do not establish a completed application.
'''
Path('docs/submission/deck-rendering.md').write_text(render,encoding='utf-8')
print('Wrote report and rendering guide')
