# AegisPay pitch — rendering and verification

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

Final export: **8 pages**, each **960×540 points (16:9)**, **271724 bytes**. SHA256:

```text
1856daa7a76675936647dbed78845f5671bad00dee3fd337362dcf01ad81fad5
```

Historical Nov 7 PDF: **147856 bytes**, SHA256 `45a46a0681cfbc8b11d904ec2a3c40b54c3954deb0dfd13a495e7e707a17762c`. This historical hash does not identify the refreshed file.

Observed final checks: zero HTML out-of-slide/footer violations, zero JS errors, expected page titles/footers, zero PDF text spans outside page, **20 HTTPS annotations / 14 distinct targets**, all four fixed destinations and three full historical transaction hashes retained. Notes/Q&A absent from PDF. All eight final PDF page renders were opened and visually inspected individually after final editorial changes. Presenter notes/N/Q&A/print controls passed. Ten existing destinations returned 200; four fragment targets refer to the single new TASK-016 report and returned prepublication 404. Publish that report together with the deck and verify those anchors plus the new remote raw-PDF hash. Existing PDF URL returning 200 before publication still serves the old bytes. Drive destination remains a folder, with new MP4 upload/playback unverified.

[Complete TASK-016 report](../evidence/finals-pitch-refresh/task-016.md) records page-by-page results, exact destinations, command outcomes, current facts and limitations, font/screenshot provenance, recoveries and the safe publication allowlist. The successful historical Nov 7 authorization is distinct from the Nov 9 unknown/unentitled application attempt. Full model purchase/recovery/hosted release remain unfinished. No payment/chain/model operation or app test was performed for this artifact change; documentation checks do not establish a completed application.


## Local presentation refresh — 2026-11-18 (TASK-034)

This new export supersedes the current presentation copy, not the historical receipts above. Publication at the existing PDF URL is pending coordinator review; no new video or financial action occurred. The deck distinguishes Nov7 integration proof, the Nov9 unresolved incident, the Nov14 Gemini QuickSignal purchase/report, and the separate claim verified Nov15Manila. Broader production/live qualification remains deferred.

Actual commands: `node scripts/render-pitch-deck.mjs`, `python scripts/check-presentation.py --pdf`, `node scripts/check-presentation-deck.mjs`. All returned exit0 using the installed pinned Playwright1.65.0 and Chromium156.0.8078.4; no install. Eight1280×720 HTML slides had zero layout violations and zero JS errors; exported PDF has eight960×540-point pages, 23 HTTPS annotations / 17 distinct targets, all historical PDF links preserved, no out-of-page text and no printed notes/Q&A. All eight PNG page renders were opened and visually reviewed after export.

New local PDF: **274483 bytes**, SHA256 `5855551530b8511bf55b23f8c56a9bf3665ef9274e5b8c1e1214ef98d018cd87`. Notes contain559words over300scheduled seconds, synchronized between HTML and Markdown. Notes button/N/Escape, Q&A open/close, arrows and print exclusion pass; the local deck made zero external requests. [New evidence](../evidence/product-presentation-2026-11-18/report.md) owns these results. Existing filenames, source/explorer/Drive/proof URLs and historical Nov7 balances/fees/hashes remain unchanged.
