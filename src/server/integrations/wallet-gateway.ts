import { createNoir, readTestnetConfig } from './noir.ts';
import { verifyContracts } from '../../../scripts/verify-contracts.ts';
import { walletFundingCeiling, type WalletGateway } from '../domain/wallet.ts';

export async function createWalletGateway(env: NodeJS.ProcessEnv): Promise<WalletGateway> {
  const config = readTestnetConfig(env);
  await verifyContracts(env);
  const noir = createNoir(config);
  return { config, ...(env.DEMO_ESCROW_FUNDING_CEILING_STROOPS?.trim() ? {
    fundingCeilingStroops: walletFundingCeiling(env), fundingDeviceHash: env.DEMO_DEVICE_HASH ?? '', fundingAgentPublicKey: env.DEMO_AGENT_PUBLIC_KEY ?? '',
  } : {}),
    prepare: noir.prepare.bind(noir), submit: noir.submit.bind(noir),
    getTransaction: noir.server.getTransaction.bind(noir.server), getPolicy: noir.getPolicy.bind(noir),
    getDeviceOwner: noir.getDeviceOwner.bind(noir), getDeviceAgent: noir.getDeviceAgent.bind(noir),
    getEscrowToken: noir.getEscrowToken.bind(noir), getEscrowBalance: noir.getEscrowBalance.bind(noir), getPendingBalance: noir.getPendingBalance.bind(noir),
    latestLedger: async () => (await noir.server.getLatestLedger()).sequence };
}
