'use client';

import { useState } from 'react';
import { PUBLIC_PROOF as proof } from '../lib/public-proof';

type Tab = 'policy' | 'run' | 'audit';

export function ProofConsole() {
  const [tab, setTab] = useState<Tab>('run');

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Proof console views">
        {(
          [
            ['policy', 'Policy'],
            ['run', 'Run'],
            ['audit', 'Audit'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'policy' ? <PolicyPanel /> : null}
      {tab === 'run' ? <RunPanel /> : null}
      {tab === 'audit' ? <AuditPanel /> : null}
    </>
  );
}

function PolicyPanel() {
  return (
    <section className="panel" role="tabpanel" aria-label="Policy">
      <h2>Policy</h2>
      <p className="note">
        Observed owner setup from the verified spike fixture. Full Freighter owner console is not claimed here.
      </p>
      <div className="grid two">
        <div className="row">
          <span>Network</span>
          <strong>{proof.network}</strong>
        </div>
        <div className="row">
          <span>Per-payment cap</span>
          <strong>{proof.policy.maxStroops} stroops</strong>
        </div>
        <div className="row">
          <span>Escrow funded</span>
          <strong>{proof.policy.escrowStroops} stroops</strong>
        </div>
        <div className="row">
          <span>Policy expiry (UTC)</span>
          <strong>{proof.policy.expiresAt}</strong>
        </div>
        <div className="row">
          <span>Device registry</span>
          <code>{proof.contracts.deviceRegistry}</code>
        </div>
        <div className="row">
          <span>Agent registry</span>
          <code>{proof.contracts.agentRegistry}</code>
        </div>
        <div className="row">
          <span>Payment escrow</span>
          <code>{proof.contracts.paymentEscrow}</code>
        </div>
        <div className="row">
          <span>Asset (Testnet XLM SAC)</span>
          <code>{proof.policy.asset}</code>
        </div>
      </div>
      <div style={{ marginTop: '1.1rem' }}>
        <span className="status refuse">Live contract simulation refused over-cap 1.2M stroops</span>
        <p className="note" style={{ marginTop: '0.65rem', marginBottom: 0 }}>
          Refusal was simulation-only (`{proof.refusal.errorName}`); no included failed transaction and nothing signed or submitted.
        </p>
      </div>
    </section>
  );
}

function RunPanel() {
  return (
    <section className="panel" role="tabpanel" aria-label="Run">
      <h2>Run</h2>
      <p className="note">
        Recorded Testnet spike run for operation `{proof.operationId}`. This is not a completed autonomous model purchase.
      </p>
      <div className="grid two">
        <div className="row">
          <span>Accepted amount</span>
          <strong>
            {proof.run.amountStroops} stroops ({proof.run.amountXlm} Testnet XLM)
          </strong>
        </div>
        <div className="row">
          <span>Nonce</span>
          <strong>{proof.run.nonce}</strong>
        </div>
        <div className="row">
          <span>Authorization</span>
          <span className="status">{proof.run.authorizationState}</span>
        </div>
        <div className="row">
          <span>Merchant claim</span>
          <span className="status">{proof.run.claimState}</span>
        </div>
        <div className="row">
          <span>Merchant</span>
          <code>{proof.run.merchant}</code>
        </div>
        <div className="row">
          <span>Agent</span>
          <code>{proof.run.agent}</code>
        </div>
        <div className="row">
          <span>Fee (matched)</span>
          <strong>{proof.fees.actualFeeStroops} stroops · {proof.fees.status}</strong>
        </div>
        <div className="row">
          <span>Observed at</span>
          <strong>{proof.observedAt}</strong>
        </div>
      </div>
      <ul className="list" style={{ marginTop: '1rem' }}>
        <li>
          Outer auth tx:{' '}
          <a href={proof.txs.outer.url} target="_blank" rel="noreferrer">
            {proof.txs.outer.hash}
          </a>
        </li>
        <li>
          Inner auth tx:{' '}
          <a href={proof.txs.inner.url} target="_blank" rel="noreferrer">
            {proof.txs.inner.hash}
          </a>
        </li>
        <li>
          Claim tx:{' '}
          <a href={proof.txs.claim.url} target="_blank" rel="noreferrer">
            {proof.txs.claim.hash}
          </a>
        </li>
      </ul>
    </section>
  );
}

function AuditPanel() {
  return (
    <section className="panel" role="tabpanel" aria-label="Audit">
      <h2>Audit</h2>
      <p className="note">
        Safe public identities from the saved evidence file. Unknown or pending states are not fabricated here.
      </p>
      <div className="grid">
        <div className="row">
          <span>Classification</span>
          <strong>{proof.classification}</strong>
        </div>
        <div className="row">
          <span>Evidence path</span>
          <code>{proof.evidencePath}</code>
        </div>
        <div className="row">
          <span>SDK pins</span>
          <strong>
            Noir {proof.sdkVersions.noir} · Stellar {proof.sdkVersions.stellar} · Velo {proof.sdkVersions.velo}
          </strong>
        </div>
        <div className="row">
          <span>Balances after authorization</span>
          <strong>
            escrow {proof.balances.afterAuthorization.escrow} · pending {proof.balances.afterAuthorization.pending}
          </strong>
        </div>
        <div className="row">
          <span>Balances after claim</span>
          <strong>
            escrow {proof.balances.afterClaim.escrow} · pending {proof.balances.afterClaim.pending}
          </strong>
        </div>
        <div className="row">
          <span>Hash roles</span>
          <strong>
            {proof.txs.outer.role}; {proof.txs.inner.role}; {proof.txs.claim.role}
          </strong>
        </div>
      </div>
    </section>
  );
}
