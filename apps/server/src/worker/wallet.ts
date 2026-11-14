import { eq } from 'drizzle-orm';
import type { Store } from '../../../../src/server/db/connection.ts';
import * as s from '../../../../src/server/db/schema.ts';
import { observeWallet, type WalletActor, type WalletGateway, type WalletObservationJob } from '../../../../src/server/domain/wallet.ts';
import { claimJob, finishJob } from './queue.ts';

// Resolve ownership exclusively from durable, constrained SQL records. No
// browser role, session token, signature or new financial intent is created.
export async function processWalletObservation(store: Store, job: WalletObservationJob, gateway: WalletGateway) {
  if (!job.leaseOwner || !['wallet_observe', 'claim_observe'].includes(job.kind)) throw new Error('WALLET_JOB_REQUIRED');
  let walletId = job.entityId;
  if (job.kind === 'claim_observe') {
    const [claim] = await store.db.select().from(s.merchantClaim).where(eq(s.merchantClaim.id, job.entityId));
    if (!claim) throw new Error('WALLET_CLAIM_NOT_FOUND');
    walletId = claim.walletOperationId;
  }
  const [wallet] = await store.db.select().from(s.walletOperation).where(eq(s.walletOperation.id, walletId));
  if (!wallet?.handoffCommittedAt || !wallet.txHash) throw new Error('WALLET_HANDOFF_REQUIRED');
  let actor: WalletActor;
  if (wallet.role === 'owner' && wallet.agentId) {
    const [agent] = await store.db.select().from(s.agent).where(eq(s.agent.id, wallet.agentId));
    if (!agent) throw new Error('WALLET_OWNER_NOT_FOUND');
    actor = { role: 'owner', ownerId: agent.ownerId, merchantId: null };
  } else if (wallet.role === 'merchant' && wallet.operationKind === 'claim') {
    const [merchant] = await store.db.select().from(s.merchant).where(eq(s.merchant.walletAddress, wallet.actorAddress));
    if (!merchant) throw new Error('WALLET_MERCHANT_NOT_FOUND');
    actor = { role: 'merchant', merchantId: merchant.id, ownerId: null };
  } else throw new Error('WALLET_ACTOR_INVALID');
  const result = await observeWallet(store, actor, walletId, gateway, job);
  return ['confirmed', 'failed'].includes(result.status);
}

export function walletConsumer(input: { store: Store; gateway: () => Promise<WalletGateway> }) {
  let active: Promise<void> | undefined;
  let stopping = false;
  async function drain() {
    for (let count = 0; count < 20 && !stopping; count++) {
      const job = await claimJob(input.store, ['wallet_observe', 'claim_observe']);
      if (!job) return;
      let done = false;
      try { done = await processWalletObservation(input.store, job, await input.gateway()); }
      finally { await finishJob(input.store, job, done); }
    }
  }
  return {
    idle: () => active ?? Promise.resolve(),
    stop: async () => { stopping = true; await active; },
    wake(): Promise<void> {
      if (stopping) return Promise.resolve();
      active ??= drain().finally(() => { active = undefined; });
      return active;
    },
  };
}
