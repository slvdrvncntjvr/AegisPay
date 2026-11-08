import { createNoir, readTestnetConfig } from './noir.js';
import { verifyContracts } from '../../../scripts/verify-contracts.js';
import type { WalletGateway } from '../domain/wallet.js';

export async function createWalletGateway(env: NodeJS.ProcessEnv): Promise<WalletGateway> {
  const config = readTestnetConfig(env);
  await verifyContracts(env);
  const noir = createNoir(config);
  return { config, prepare: noir.prepare.bind(noir), submit: noir.submit.bind(noir),
    getTransaction: noir.server.getTransaction.bind(noir.server), getPolicy: noir.getPolicy.bind(noir),
    getDeviceOwner: noir.getDeviceOwner.bind(noir), getDeviceAgent: noir.getDeviceAgent.bind(noir),
    getEscrowToken: noir.getEscrowToken.bind(noir), getEscrowBalance: noir.getEscrowBalance.bind(noir), getPendingBalance: noir.getPendingBalance.bind(noir),
    latestLedger: async () => (await noir.server.getLatestLedger()).sequence };
}
