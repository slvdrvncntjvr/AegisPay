'use client';
import { getAddress, getNetworkDetails, requestAccess, signTransaction } from '@stellar/freighter-api';

export async function connectedTestnetWallet(expected: string) {
  const allowed = await requestAccess();
  if (allowed.error) throw new Error('Freighter access was declined');
  const [address, network] = await Promise.all([getAddress(), getNetworkDetails()]);
  if (address.error || network.error || address.address !== expected) throw new Error('Connect the configured wallet for this role');
  if (network.networkPassphrase !== 'Test SDF Network ; September 2015') throw new Error('Select Stellar Testnet in Freighter');
  return address.address;
}
export async function signPreparedWallet(prepared: { unsignedXdr: string; signerAddress: string; networkPassphrase: string }) {
  await connectedTestnetWallet(prepared.signerAddress);
  if (prepared.networkPassphrase !== 'Test SDF Network ; September 2015') throw new Error('Testnet is required');
  const result = await signTransaction(prepared.unsignedXdr, { networkPassphrase: prepared.networkPassphrase, address: prepared.signerAddress });
  if (result.error || !result.signedTxXdr || result.signerAddress !== prepared.signerAddress) throw new Error('Wallet signature was declined or does not match');
  return result.signedTxXdr;
}
