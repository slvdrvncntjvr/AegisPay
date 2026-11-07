/**
 * Public, redacted facts from the verified same-transaction Noir/Velo Testnet spike.
 * No secrets, agent keys, signed XDR, or private journals.
 * Source evidence file: docs/evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794064999769.json
 */
export const PUBLIC_PROOF = {
  label: 'Verified Testnet spike · not a completed model purchase',
  classification: 'live-same-transaction-noir-velo-spike',
  observedAt: '2026-11-07T15:23:19.766Z',
  network: 'Stellar Testnet',
  operationId: 'c080d947-714b-43cf-92d0-ad9ed7c01439',
  evidencePath:
    'docs/evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794064999769.json',
  githubRepo: 'https://github.com/slvdrvncntjvr/AegisPay',
  pitchPdf:
    'https://github.com/slvdrvncntjvr/AegisPay/blob/main/docs/submission/AegisPay-pitch-draft.pdf',
  pitchPdfRepoPath: 'docs/submission/AegisPay-pitch-draft.pdf',
  sdkVersions: { noir: '0.3.0', stellar: '16.4.1', velo: '1.0.0' },
  contracts: {
    deviceRegistry: 'CAC4KOLHDLDYDWBOKXNKRN5KVHO56PLOIFXDLTBUWGVN6GVDEB7FQHU5',
    agentRegistry: 'CCMZDSPTLX7IIJWCYEUM5DJUHOSOYSTHGK777S2TXZWEMC5ZZGPJ3EBV',
    paymentEscrow: 'CC7EAW5FNJEDBS7THM5IT6XIOHO4AOYMLXT3KSZ3HWUIKEACTW7E5BFS',
  },
  policy: {
    maxStroops: '1000000',
    escrowStroops: '10000000',
    asset: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    expiresAt: '2026-11-07T15:32:08.000Z',
  },
  refusal: {
    classification: 'live-contract-simulation-refusal',
    includedTransaction: false,
    amountStroops: '1200000',
    capStroops: '1000000',
    errorName: 'AgentNotAuthorized',
  },
  run: {
    amountStroops: '300000',
    amountXlm: '0.0300000',
    nonce: '1',
    merchant: 'GC3SHUY27GQV7Z5IPHFQWPQJR6SL2CCS72FVNZALHQVX5D7IGGPWHVEX',
    agent: 'GB7YL3X5MJ5QSZR3ABWVVOE2QNRVVLFJTXI6GQ55A2SPGAVL6R2F7XBR',
    authorizationState: 'Authorized in escrow',
    claimState: 'Claimed by merchant',
  },
  txs: {
    outer: {
      hash: '6e898ad830e866f0831577849361739cea7ad03cfbfcee9febf0fc057633d381',
      url: 'https://stellar.expert/explorer/testnet/tx/6e898ad830e866f0831577849361739cea7ad03cfbfcee9febf0fc057633d381',
      role: 'Outer fee-bump / observed event transaction',
    },
    inner: {
      hash: '1d39c3e3d7f400475aa2686f173a943346c5870635731fbd62fa41f1f912fa7a',
      url: 'https://stellar.expert/explorer/testnet/tx/1d39c3e3d7f400475aa2686f173a943346c5870635731fbd62fa41f1f912fa7a',
      role: 'Inner Noir authorization',
    },
    claim: {
      hash: '94cea8bb561576ab71d4419571b92bd2fe7d8eada1273ff16960a716160c9a18',
      url: 'https://stellar.expert/explorer/testnet/tx/94cea8bb561576ab71d4419571b92bd2fe7d8eada1273ff16960a716160c9a18',
      role: 'Separate merchant claim',
    },
  },
  fees: {
    actualFeeStroops: '82496',
    status: 'matched (outer ledger = Velo reported)',
  },
  balances: {
    afterAuthorization: { escrow: '9700000', pending: '300000' },
    afterClaim: { escrow: '9700000', pending: '0' },
  },
} as const;
