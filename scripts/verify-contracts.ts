// TASK-002 extends this non-spending entrypoint with independent ledger checks.
import { Networks } from '@stellar/stellar-sdk';

if (process.env.STELLAR_NETWORK !== 'testnet' ||
    process.env.STELLAR_NETWORK_PASSPHRASE !== Networks.TESTNET) {
  console.error(JSON.stringify({ status: 'not_run', code: 'TESTNET_CONFIGURATION_REQUIRED' }));
  process.exitCode = 1;
} else {
  console.error(JSON.stringify({ status: 'not_run', code: 'LIVE_CONTRACT_VERIFICATION_NOT_IMPLEMENTED' }));
  process.exitCode = 1;
}
