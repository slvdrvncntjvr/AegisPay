import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as freighter from '@stellar/freighter-api';
import { connectedTestnetWallet, signPreparedWallet, walletErrorText } from '../../apps/web/src/components/wallet.ts';

vi.mock('@stellar/freighter-api', () => ({ isConnected: vi.fn(), requestAccess: vi.fn(), getAddress: vi.fn(), getNetworkDetails: vi.fn(), signTransaction: vi.fn() }));
const address = 'G' + 'A'.repeat(55);
const passphrase = 'Test SDF Network ; September 2015';
const prepared = () => ({ signerAddress: address, unsignedXdr: 'SYNTHETIC_UNSIGNED_XDR', networkPassphrase: passphrase, expiresAt: new Date(Date.now() + 120000).toISOString() });
describe('Freighter connection and signature boundaries (synthetic browser API)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(freighter.isConnected).mockResolvedValue({ isConnected: true });
    vi.mocked(freighter.requestAccess).mockResolvedValue({ address });
    vi.mocked(freighter.getAddress).mockResolvedValue({ address });
    vi.mocked(freighter.getNetworkDetails).mockResolvedValue({ network: 'TESTNET', networkPassphrase: passphrase, networkUrl: 'https://horizon-testnet.stellar.org' });
    vi.mocked(freighter.signTransaction).mockResolvedValue({ signerAddress: address, signedTxXdr: 'SYNTHETIC_SIGNED_XDR' });
  });
  afterEach(() => vi.useRealTimers());
  it('refuses absent extension before requesting access or signature', async () => {
    vi.mocked(freighter.isConnected).mockResolvedValue({ isConnected: false });
    await expect(connectedTestnetWallet(address)).rejects.toMatchObject({ code: 'WALLET_NOT_DETECTED' });
    expect(freighter.requestAccess).not.toHaveBeenCalled(); expect(freighter.signTransaction).not.toHaveBeenCalled();
  });
  it('distinguishes wrong account from wrong network without signing', async () => {
    vi.mocked(freighter.getAddress).mockResolvedValue({ address: 'G' + 'B'.repeat(55) });
    await expect(signPreparedWallet(prepared())).rejects.toMatchObject({ code: 'WALLET_ACCOUNT_MISMATCH' });
    vi.mocked(freighter.getAddress).mockResolvedValue({ address });
    vi.mocked(freighter.getNetworkDetails).mockResolvedValue({ network: 'PUBLIC', networkPassphrase: 'Public Global Stellar Network ; September 2015', networkUrl: '' });
    await expect(signPreparedWallet(prepared())).rejects.toMatchObject({ code: 'WALLET_WRONG_NETWORK' });
    expect(freighter.signTransaction).not.toHaveBeenCalled();
  });
  it('never exposes arbitrary extension rejection messages or private payloads', async () => {
    vi.mocked(freighter.signTransaction).mockResolvedValue({ signerAddress: '', signedTxXdr: '', error: { code: -4, message: 'PRIVATE_EXTENSION_PAYLOAD' } });
    try { await signPreparedWallet(prepared()); throw Error('expected rejection'); }
    catch (error) { expect(walletErrorText(error)).toContain('Freighter error code: -4'); expect(walletErrorText(error)).not.toContain('PRIVATE_EXTENSION_PAYLOAD'); }
  });
  it('requires the exact returned signer while forwarding the prepared Testnet body', async () => {
    const input = prepared();
    expect(await signPreparedWallet(input)).toBe('SYNTHETIC_SIGNED_XDR');
    expect(freighter.signTransaction).toHaveBeenCalledWith(input.unsignedXdr, { address, networkPassphrase: passphrase });
    vi.mocked(freighter.signTransaction).mockResolvedValue({ signerAddress: 'G' + 'B'.repeat(55), signedTxXdr: 'SYNTHETIC_SIGNED_XDR' });
    await expect(signPreparedWallet(prepared())).rejects.toMatchObject({ code: 'WALLET_SIGNER_MISMATCH' });
  });
  it('refuses an expired preparation before touching the extension', async () => {
    await expect(signPreparedWallet({ ...prepared(), expiresAt: new Date(Date.now() - 1).toISOString() })).rejects.toMatchObject({ code: 'WALLET_PREPARATION_EXPIRED' });
    expect(freighter.isConnected).not.toHaveBeenCalled(); expect(freighter.signTransaction).not.toHaveBeenCalled();
  });
  it('bounds extension detection and discards a signature arriving after expiry', async () => {
    vi.useFakeTimers();
    vi.mocked(freighter.isConnected).mockImplementation(() => new Promise(() => {}));
    const detection = expect(connectedTestnetWallet(address)).rejects.toMatchObject({ code: 'WALLET_CONNECTION_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(5000); await detection;
    vi.mocked(freighter.isConnected).mockResolvedValue({ isConnected: true });
    let finish!: (value: Awaited<ReturnType<typeof freighter.signTransaction>>) => void;
    vi.mocked(freighter.signTransaction).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const signing = expect(signPreparedWallet({ ...prepared(), expiresAt: new Date(Date.now() + 1000).toISOString() })).rejects.toMatchObject({ code: 'WALLET_SIGNING_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(1000); await signing;
    finish({ signerAddress: address, signedTxXdr: 'LATE_SYNTHETIC_SIGNATURE' });
    await vi.advanceTimersByTimeAsync(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
