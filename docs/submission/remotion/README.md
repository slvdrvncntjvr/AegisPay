# Optional AegisPay evidence-replay video

This isolated Remotion package does not belong to the root pnpm workspace. Source imports the public saved proof JSON; capture scripts use the root's existing pinned Playwright **1.65.0** and the installed Edge browser. No environment files, financial secrets or private journals are loaded.

From this directory:

```powershell
npm ci --strict-peer-deps --ignore-scripts
node capture.mjs
node capture-proof.mjs
node verify-links.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@remotion/cli/remotion-cli.js versions
node node_modules/@remotion/cli/remotion-cli.js browser ensure
node node_modules/@remotion/cli/remotion-cli.js render src/index.ts Demo out/aegispay-demo.mp4 --codec=h264 --concurrency=2 --crf=20
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,pix_fmt -of json out/aegispay-demo.mp4
```

`capture.mjs` and `capture-proof.mjs` deliberately fail a viewport gate if document width exceeds 390px. Their generated screenshots, real browser recording, safe evidence copy and reports are ignored under `public/` and `captures/`; the MP4 is ignored under `out/`. Preserve source here and publish the actual verified MP4 in the user's fixed Drive folder. A local render is not an uploaded video. See [delivery status](../delivery-status.md) for exact observed artifacts, failures and next steps.
