import { ProofConsole } from './console';
import { PUBLIC_PROOF as proof } from '../lib/public-proof';

export default function HomePage() {
  return (
    <>
      <div className="banner" role="status">
        Stellar Testnet proof console · verified spike evidence · full model loop and durable app gates remain unfinished
      </div>
      <main>
        <header className="hero">
          <p className="brand">AegisPay</p>
          <p className="lede">
            Bounded agent spending with Noir policy limits and Velo-sponsored Stellar Testnet execution.
            This public site surfaces the verified same-transaction authorization, simulation refusal, and
            separate merchant claim—not a completed autonomous model purchase.
          </p>
          <div className="meta">
            <span className="status warn">{proof.label}</span>
            <a href={proof.githubRepo} target="_blank" rel="noreferrer">
              GitHub repository
            </a>
            <a href={proof.pitchPdf} target="_blank" rel="noreferrer">
              Pitch PDF ({proof.pitchPdfRepoPath})
            </a>
            <a href="/api/health">Health JSON</a>
          </div>
        </header>

        <ProofConsole />

        <p className="footer">
          Event-alone evidence is insufficient; independent matching Noir envelope, invocation, and event were
          required for the saved authorization. Authorization credits merchant-pending escrow; claim is separate.
        </p>
      </main>
    </>
  );
}
