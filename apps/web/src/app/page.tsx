import { ProofConsole } from './console';
import { PUBLIC_PROOF as proof } from '../lib/public-proof';
import { Icon, Mark } from '../components/visual';

export default function HomePage() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header wrap">
      <a className="brand" href="/" aria-label="AegisPay home"><Mark />AegisPay<span className="brand-period">.</span></a>
      <nav aria-label="Main navigation"><a href="#proof">Explore proof</a><a className="nav-story" href="#use-case">The use case</a><a className="nav-pitch" href={proof.pitchPdf} target="_blank" rel="noreferrer">Pitch deck<Icon name="external" /></a></nav>
    </header>
    <main id="main" className="wrap">
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Useful data.<br /><span>Bounded spending.</span></h1>
        <div className="hero-aside"><p>Let a release assistant buy a specialist report.<br className="desktop-break" /> Keep payment authority within your rules.</p><p className="hero-detail">Noir sets the permission. Velo carries the same authorization. Independent evidence checks the result.</p><a className="button primary" href="#proof">Explore the verified proof<Icon name="arrow" /></a></div>
      </section>
      <p className="hero-detail"><a href="https://aegispay-finals-app.onrender.com/login">Open the Testnet application ↗</a> · Private owner and merchant access</p>
      <ProofConsole />
      <section className="use-case" id="use-case" aria-labelledby="use-case-title">
        <div className="use-case-intro"><h2 id="use-case-title">Give the agent a task.<br />Keep the authority.</h2><p>A developer’s assistant may need a specialist report. AegisPay lets it choose useful data while trusted tools enforce the accepted price, task budget and wallet policy.</p><span className="label-neutral">Fictional report workflow</span></div>
        <div className="scenario"><div className="task-prompt"><Icon name="intent" /><p>“Review the <strong>fictional parser</strong> dependency for a basic release triage note. Buy only what’s needed, within <strong>0.10 Testnet XLM</strong>.”</p></div><div className="offer-line"><span>QuickSignal<small>Fictional basic report</small></span><strong>0.03 <span>XLM</span></strong><span className="offer-note">Paid quote · 14 Nov</span></div><div className="offer-line"><span>DeepTrace<small>Fictional extended report</small></span><strong>0.12 <span>XLM</span></strong><span className="offer-note over">Above example cap</span></div><p className="scenario-note">Gemini bought QuickSignal and read the entitled fictional report on 14 November for 0.03 Testnet XLM. A separate merchant claim was verified on 15 November Manila time. Future QuickSignal quotes were set to 0.04 XLM; the paid quote stays unchanged.</p></div>
      </section>
      <section className="principles" aria-labelledby="principles-title"><h2 id="principles-title">Permission is only<br />part of the proof.</h2><div><dl><div><dt>The model proposes. Rules decide.</dt><dd>A per-payment cap, finite escrow and an application task budget are separate controls. A cap is not a daily on-chain budget.</dd></div><div><dt>Authorization comes before claim.</dt><dd>Verified authorization credits merchant-pending escrow. A separate merchant claim moves it out of pending.</dd></div><div><dt>Uncertainty keeps its identity.</dt><dd>An unknown result stays unresolved. Observe the saved operation; never sign or submit another payment to clear a timeout.</dd></div></dl><p className="readiness">The hosted Testnet application preserves the verified purchase, report and separate claim history. The 7 November integration proof above is a different operation. The original report window and owner policy have expired; broader production qualification remains deferred.</p></div></section>
    </main>
    <footer className="site-footer wrap"><div><a className="brand" href="https://aegispay-live.vercel.app/"><Mark />AegisPay<span className="brand-period">.</span></a><p>Agent intent. Human limits. Verifiable payment.</p></div><nav aria-label="Project links"><a href={proof.githubRepo} target="_blank" rel="noreferrer">GitHub<Icon name="external" /></a><a href={proof.pitchPdf} target="_blank" rel="noreferrer">Pitch PDF<Icon name="external" /></a><a href="https://drive.google.com/drive/folders/1hqwzOaG_qU9axjcLIjBUb1YeMWdOFq72?usp=sharing" target="_blank" rel="noreferrer">Video folder<Icon name="external" /></a><a href="/api/health">Service health<Icon name="arrow" /></a></nav><p className="footer-bottom">Built on Stellar Testnet. Real funds are not used.<span>Recorded proof · 7 November 2026</span></p></footer>
  </>;
}
