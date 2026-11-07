# AegisPay draft deck — rendering and verification

Prepared 2026-11-07 from base `952344dd0c036a3ea390d1bfbadc5b8c640aff23` on isolated Orca work ref `slvdrvncntjvr/pitch-deck-render`. This is local artifact preparation, not TASK-013 completion or a published submission. No task status, canonical document, dependency manifest or lockfile was changed.

## Artifacts and presentation

- [deck.html](deck.html): self-contained eight-slide HTML/CSS deck with native SVG shield and CSS flow diagrams. No remote fonts, image assets, raster mockups or product screenshots. Open locally; arrow keys navigate, **N** toggles timed speaker notes, and the Q&A button opens presenter prompts.
- [AegisPay-pitch-draft.pdf](AegisPay-pitch-draft.pdf): standalone, searchable, tagged PDF; exactly **8 pages**, each **960 × 540 points (16:9)**. Each slide has one exact print page. Notes, controls and Q&A prompts are excluded.
- [render-pitch-deck.mjs](../../scripts/render-pitch-deck.mjs): uses only existing exact `@playwright/test` **1.65.0**, checks HTML bounds/footer clearance and exports with print backgrounds and CSS page size. It does not load environment files, contact payment services or install anything.

The notes total **300 seconds**: 25 + 30 + 75 + 40 + 35 + 35 + 30 + 30. The 75-second segment is an honest saved-evidence walkthrough while the app is unfinished. Three-minute Q&A follows the pitch. The separate two-minute submission recording remains pending; its existing script is linked, not represented as a recorded video.

## Claims and provenance

Read AGENTS.md, documentation index, implementation plan, decision ledger, root README, context, submission README, pitch-deck source, recording script, relevant PRD/methods passages, Velo handoff/verifier source and the redacted proof artifacts. Public source links are pinned to the full base commit; repo/explorer links remain external HTTPS links in the PDF.

The older pitch-source text still mentioned pending TASK-002 review fixes. This derived artifact follows the newer authoritative plan/README and latest evidence: TASK-001 and TASK-002 are done; real workspaces and app/database/model/UI/deployment remain unfinished **as of the base checkpoint**. No canonical source was edited. Later work elsewhere is outside this snapshot.

The proof slide uses [post-review saved evidence](../evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794064999769.json), observed `2026-11-07T15:23:19.766Z`, for operation `c080d947-714b-43cf-92d0-ad9ed7c01439`:

| Identity | Full hash / meaning |
|---|---|
| Authorization inner | `1d39c3e3d7f400475aa2686f173a943346c5870635731fbd62fa41f1f912fa7a` |
| Authorization outer / observed event hash | `6e898ad830e866f0831577849361739cea7ad03cfbfcee9febf0fc057633d381` |
| Separate merchant claim | `94cea8bb561576ab71d4419571b92bd2fe7d8eada1273ff16960a716160c9a18` |

One authorization is 300000 stroops / 0.03 Testnet XLM. The inner and outer hashes map to the same payment. Escrow is 10000000 → 9700000; merchant pending is 0 → 300000 → 0 after the separate claim. Multiple reports/re-observations are not extra purchases. The over-cap refusal is actual deployed-contract simulation, unsigned/unsubmitted, not an included failed transaction. The 51/51 acceptance result is attributed to the recorded source checkpoint; payment/application tests were not rerun for this deck.

The deck visibly distinguishes configured headless agent-key authorization from a real autonomous model purchase and from protected-resource entitlement. It retains unknown-state recovery, event insufficiency, pending-versus-claim semantics and pending PostgreSQL race gates. Fixture reports are labeled fictional. No market data, traction, fee/latency benchmark, completed-app, production-audit or x402 conformance claim was added. No full Handbook content is reproduced.

## Exact export method

Node **24.22.1**, existing `@playwright/test` **1.65.0**, local Microsoft Edge **157.0.4341.42**, PyMuPDF **1.26.4**. The matching Playwright Chromium headless-shell revision 1254 was absent; the first default-browser launch failed before export. The authorized local Edge fallback then exported successfully. No browser download, dependency install or system change was needed.

PowerShell, from repository root, using the existing pinned package in the sibling review workspace:

```powershell
$env:PLAYWRIGHT_PACKAGE_PATH = 'C:/Users/Vincent/orca/workspaces/Noir X Velo/task-002-review-fixes/node_modules/@playwright/test/package.json'
$env:DECK_BROWSER_EXECUTABLE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
$env:DECK_CHECK_DIR = Join-Path $env:TEMP 'aegispay-deck-check'
node scripts/render-pitch-deck.mjs
```

With a local installation of the same pinned package, omit `PLAYWRIGHT_PACKAGE_PATH`; with Playwright's matching installed Chromium, omit `DECK_BROWSER_EXECUTABLE`. These are export-only variables, not payment credentials. The exporter rejects any Playwright package version other than 1.65.0. It blocks non-file subresource requests and does not open external proof pages during rendering.

Observed export result: exit **0**, 8 slides, each 1280 × 720 CSS pixels, **0 out-of-slide or footer-overlap violations**, **0 page JavaScript errors**, and **21 external link annotations**. PDF size **147856 bytes**; SHA256:

```text
45a46a0681cfbc8b11d904ec2a3c40b54c3954deb0dfd13a495e7e707a17762c
```

## PDF textual and visual checks

Used PyMuPDF to open the exported PDF, assert exactly eight pages and each page's 960 × 540 point rectangle, extract text per page, assert the expected title and `01 / 08` through `08 / 08` footer, inspect every text-span bounding box for page containment, and inspect PDF link annotations. All passed. Notes timing and Q&A presenter panel text were absent from PDF text. All three full transaction hashes survived in clickable annotation targets.

| Page | Extracted characters | External links | Text spans outside page | Visual result |
|---|---:|---:|---:|---|
| 1 | 580 | 2 | 0 | Readable title, flow and current-proof disclosure |
| 2 | 887 | 1 | 0 | Readable three-column problem framing |
| 3 | 920 | 2 | 0 | Readable fixture offers and unbuilt model/tool distinction |
| 4 | 916 | 3 | 0 | Readable SDK flow, target architecture and caveat |
| 5 | 1098 | 5 | 0 | Readable proof table, hash links, refusal and observation labels |
| 6 | 865 | 3 | 0 | Readable recovery flow and implemented/pending boundaries |
| 7 | 863 | 2 | 0 | Readable pilot sequence and unvalidated-demand disclosure |
| 8 | 1189 | 3 | 0 | Readable milestones, repo URL, missing assets and deadline caveat |

Rendered **every PDF page**, not HTML screenshots, to 1280 × 720 PNG using `page.get_pixmap(matrix=fitz.Matrix(4/3, 4/3), alpha=False)`. Opened and visually inspected pages 1–8 individually. No clipped text, overlapping content, missing glyphs, blank/extra page or unreadable link labels was observed. Footers remain separated from content. The PDF embeds Segoe UI font subsets and contains **zero raster images**. Temporary page images/text and JSON check output are under `%TEMP%/aegispay-deck-check`; they are inspection scratch artifacts and are not required to view the PDF.

Core PDF inspection can be repeated with existing PyMuPDF:

```powershell
@'
import fitz, pathlib, os
d = fitz.open('docs/submission/AegisPay-pitch-draft.pdf')
assert len(d) == 8
out = pathlib.Path(os.environ['TEMP']) / 'aegispay-deck-check'
out.mkdir(exist_ok=True)
for i, page in enumerate(d):
    assert tuple(page.rect) == (0, 0, 960, 540)
    assert f'{i+1:02} / 08' in page.get_text()
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                assert page.rect.contains(fitz.Rect(span['bbox']))
    assert any('uri' in link for link in page.get_links())
    page.get_pixmap(matrix=fitz.Matrix(4/3, 4/3), alpha=False).save(out / f'page-{i+1}.png')
print('PASS: eight 16:9 pages, footer IDs, text bounds and links')
'@ | python -
```

Separately exercised HTML speaker-note button and **N** shortcut, Q&A open/close, and print-media hiding of notes/Q&A/toolbar through pinned Playwright + Edge: **PASS**. HTTP GET checks with Node built-in `fetch`, anonymous requests, 20-second timeout and batches of four returned **200 for all 17 distinct PDF link targets** (21 annotations). This checks page availability; explorer pages are client-rendered and an HTTP 200 does not independently reverify ledger state. Link fragments are source anchors, not a new payment observation.

Repository verification, both exit **0**:

```text
python tools/check-docs.py
python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict
```

The documentation checker passed its existing 21-file suite, and the plan checker approved the coherent 13-task DAG. Those checks do not establish application behavior; their generic “integration remain unrun” output describes their own scope and does not supersede the existing recorded TASK-002 acceptance. `git diff --check` also passed. No root package scripts or application tests were run for this rendering-only change.

## Remaining limits and publication

This useful draft is not uploaded and has no public deck URL. Public app/video/deck URLs and Discord handle remain pending. Registration, organizer-specific Gas interpretation and late acceptance are unconfirmed; no extension or eligibility is asserted. Real workspaces, model/app/DB/UI and hosting must pass their actual gates before updating the narrative to a completed application or submission. No new payment, provider call, private journal or secret was accessed during artifact preparation. GitHub and explorer availability checks are read-only public web requests. Only the four authorized artifact/export files are committed; nothing is pushed.
