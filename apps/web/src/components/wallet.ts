'use client';
import { getAddress, getNetworkDetails, isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';

type WalletCode = 'WALLET_NOT_DETECTED' | 'WALLET_CONNECTION_TIMEOUT' | 'WALLET_ACCESS_UNAVAILABLE' | 'WALLET_ACCOUNT_MISMATCH' | 'WALLET_NETWORK_UNAVAILABLE' | 'WALLET_WRONG_NETWORK' | 'WALLET_SIGNATURE_REJECTED' | 'WALLET_SIGNER_MISMATCH' | 'WALLET_PREPARATION_EXPIRED' | 'WALLET_SIGNING_TIMEOUT';
export class WalletConnectionError extends Error {
  constructor(readonly code: WalletCode, readonly extensionCode?: number) { super(code); }
}
const messages: Record<WalletCode, string> = {
  WALLET_NOT_DETECTED: 'Freighter is not available in this browser. Open its extension, unlock it, and allow access to this site.',
  WALLET_CONNECTION_TIMEOUT: 'Freighter did not respond. Unlock the extension and check its pending requests, then check the connection again.',
  WALLET_ACCESS_UNAVAILABLE: 'Freighter access was not granted. Unlock it and allow this site to connect to the configured account.',
  WALLET_ACCOUNT_MISMATCH: 'Freighter has a different account selected. Select the required signer shown below, then check the connection again.',
  WALLET_NETWORK_UNAVAILABLE: 'Freighter could not report its network. Unlock the extension and check its connection again.',
  WALLET_WRONG_NETWORK: 'Select Stellar Testnet in Freighter, then check the connection again.',
  WALLET_SIGNATURE_REJECTED: 'Freighter did not return a signature. Check the rejection shown in its popup; no submission was made by this action.',
  WALLET_SIGNER_MISMATCH: 'Freighter returned a different signer. Select the required account; this signature was not submitted.',
  WALLET_PREPARATION_EXPIRED: 'This unsigned preparation has expired. Check its saved status, then prepare the action again.',
  WALLET_SIGNING_TIMEOUT: 'Freighter signing did not finish before the preparation expired. Check the saved status before preparing again.',
};
export function walletErrorText(error: unknown): string {
  return error instanceof WalletConnectionError ? messages[error.code] + (Number.isSafeInteger(error.extensionCode) && Math.abs(error.extensionCode!) <= 1000000 ? ` Freighter error code: ${error.extensionCode}.` : '') : 'The wallet connection failed. Open Freighter, check its account and Testnet selection, then check the connection again.';
}
async function bounded<T>(call: () => Promise<T>, ms: number, code: WalletCode): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([call(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new WalletConnectionError(code)), ms); })]);
  } catch (error) { if (error instanceof WalletConnectionError) throw error; throw new WalletConnectionError(code); }
  finally { if (timer) clearTimeout(timer); }
}

export async function connectedTestnetWallet(expected: string) {
  const connection = await bounded(isConnected, 5000, 'WALLET_CONNECTION_TIMEOUT');
  if (connection.error || !connection.isConnected) throw new WalletConnectionError('WALLET_NOT_DETECTED');
  const allowed = await bounded(requestAccess, 60000, 'WALLET_ACCESS_UNAVAILABLE');
  if (allowed.error) throw new WalletConnectionError('WALLET_ACCESS_UNAVAILABLE');
  const [address, network] = await Promise.all([bounded(getAddress, 5000, 'WALLET_CONNECTION_TIMEOUT'), bounded(getNetworkDetails, 5000, 'WALLET_NETWORK_UNAVAILABLE')]);
  if (address.error || !address.address) throw new WalletConnectionError('WALLET_ACCESS_UNAVAILABLE');
  if (address.address !== expected) throw new WalletConnectionError('WALLET_ACCOUNT_MISMATCH');
  if (network.error) throw new WalletConnectionError('WALLET_NETWORK_UNAVAILABLE');
  if (network.networkPassphrase !== 'Test SDF Network ; September 2015') throw new WalletConnectionError('WALLET_WRONG_NETWORK');
  return address.address;
}
export async function signPreparedWallet(prepared: { unsignedXdr: string; signerAddress: string; networkPassphrase: string; expiresAt?: string }) {
  const deadline = prepared.expiresAt === undefined ? Date.now() + 120000 : Date.parse(prepared.expiresAt);
  if (!Number.isFinite(deadline) || deadline <= Date.now()) throw new WalletConnectionError('WALLET_PREPARATION_EXPIRED');
  await connectedTestnetWallet(prepared.signerAddress);
  if (prepared.networkPassphrase !== 'Test SDF Network ; September 2015') throw new WalletConnectionError('WALLET_WRONG_NETWORK');
  if (deadline <= Date.now()) throw new WalletConnectionError('WALLET_PREPARATION_EXPIRED');
  const result = await bounded(() => signTransaction(prepared.unsignedXdr, { networkPassphrase: prepared.networkPassphrase, address: prepared.signerAddress }), deadline - Date.now(), 'WALLET_SIGNING_TIMEOUT');
  if (deadline <= Date.now()) throw new WalletConnectionError('WALLET_PREPARATION_EXPIRED');
  if (result.error || !result.signedTxXdr) throw new WalletConnectionError('WALLET_SIGNATURE_REJECTED', result.error?.code);
  if (result.signerAddress !== prepared.signerAddress) throw new WalletConnectionError('WALLET_SIGNER_MISMATCH');
  return result.signedTxXdr;
}
