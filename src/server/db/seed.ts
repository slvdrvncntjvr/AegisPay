import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { accountSchema, contractSchema, hashSchema } from '@aegispay/shared';
import type { Store } from './connection.js';
import * as s from './schema.js';

export const seedConfigSchema = z.strictObject({
  ownerAddress: accountSchema, agentAddress: accountSchema, merchantAddress: accountSchema, deviceHash: hashSchema,
  deviceContractId: contractSchema, agentContractId: contractSchema, escrowContractId: contractSchema, assetContractId: contractSchema,
});
export type SeedConfig = z.infer<typeof seedConfigSchema>;

export async function seedDemo(store: Store, input: SeedConfig) {
  const config = seedConfigSchema.parse(input);
  if (new Set([config.ownerAddress, config.agentAddress, config.merchantAddress]).size !== 3) throw new Error('SEED_DISTINCT_IDENTITIES_REQUIRED');
  return store.transaction(async db => {
    // Serialize the catalog seed in addition to SQL uniqueness. Never rewrite policy,
    // nonces, prices, accepted terms, balances, proof or entitlement on a second seed.
    await db.execute(sql`select pg_advisory_xact_lock(hashtextextended('aegispay-demo-seed', 0))`);
    await db.insert(s.owner).values({ id: randomUUID(), walletAddress: config.ownerAddress }).onConflictDoNothing();
    await db.insert(s.merchant).values({ id: randomUUID(), name: 'AegisPay demo merchant', walletAddress: config.merchantAddress }).onConflictDoNothing();
    const [owner] = await db.select().from(s.owner).where(eq(s.owner.walletAddress, config.ownerAddress));
    const [merchant] = await db.select().from(s.merchant).where(eq(s.merchant.walletAddress, config.merchantAddress));
    const [existing] = await db.select().from(s.agent).where(eq(s.agent.publicKey, config.agentAddress));
    if (existing) {
      if (existing.ownerId !== owner!.id || existing.deviceHash !== config.deviceHash || existing.assetContractId !== config.assetContractId || existing.deviceContractId !== config.deviceContractId || existing.agentContractId !== config.agentContractId || existing.escrowContractId !== config.escrowContractId) throw new Error('SEED_IDENTITY_CONFLICT');
    } else await db.insert(s.agent).values({
      id: randomUUID(), ownerId: owner!.id, publicKey: config.agentAddress, deviceHash: config.deviceHash, network: 'testnet',
      deviceContractId: config.deviceContractId, agentContractId: config.agentContractId, escrowContractId: config.escrowContractId, assetContractId: config.assetContractId,
      policyMaxStroops: '0', policyExpiresAt: new Date(0), policyObservedLedger: null, status: 'unprovisioned',
    });
    for (const [slug, label, price] of [['quick-signal','QuickSignal','300000'], ['deep-trace','DeepTrace','1200000']] as const) {
      const key = `${slug}:demo-parser:v1`;
      const [offer] = await db.select().from(s.resource).where(eq(s.resource.resourceKey, key));
      if (offer) {
        if (offer.merchantId !== merchant!.id || offer.assetContractId !== config.assetContractId || offer.fixtureVersion !== 'v1' || offer.routeSlug !== slug) throw new Error('SEED_CATALOG_CONFLICT');
      } else await db.insert(s.resource).values({ id: randomUUID(), merchantId: merchant!.id, resourceKey: key, routeSlug: slug,
        description: `${label}: fictional demo-parser dependency report (demo content)`, priceStroops: price, assetContractId: config.assetContractId, fixtureVersion: 'v1', isDemo: true });
    }
    return { ownerId: owner!.id, merchantId: merchant!.id, offers: 2, policy: 'unprovisioned-until-observed' as const };
  });
}

export function seedConfigFromEnvironment(env: NodeJS.ProcessEnv = process.env): SeedConfig {
  const fields = {
    ownerAddress: 'DEMO_OWNER_PUBLIC_KEY', agentAddress: 'DEMO_AGENT_PUBLIC_KEY', merchantAddress: 'DEMO_MERCHANT_PUBLIC_KEY', deviceHash: 'DEMO_DEVICE_HASH',
    deviceContractId: 'NOIR_DEVICE_REGISTRY_ID', agentContractId: 'NOIR_AGENT_REGISTRY_ID', escrowContractId: 'NOIR_PAYMENT_ESCROW_ID', assetContractId: 'NOIR_XLM_SAC_ID',
  } as const;
  const missing = Object.values(fields).filter(name => !env[name]);
  if (missing.length) throw new Error(`MISSING_SEED_CONFIGURATION: ${missing.join(', ')}`);
  return seedConfigSchema.parse(Object.fromEntries(Object.entries(fields).map(([key, name]) => [key, env[name]])));
}
