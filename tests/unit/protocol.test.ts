import { describe, expect, it } from 'vitest';
import { StrKey } from '@stellar/stellar-sdk';
import { randomBytes } from 'node:crypto';
import { accountSchema, contractSchema, quoteChallengeSchema, toolIntentSchema } from '@aegispay/shared';

describe('client-safe protocol schemas', () => {
  it('validates account and contract StrKey checksums without importing signer code', () => {
    const account = StrKey.encodeEd25519PublicKey(randomBytes(32));
    const contract = StrKey.encodeContract(randomBytes(32));
    expect(accountSchema.parse(account)).toBe(account);
    expect(contractSchema.parse(contract)).toBe(contract);
    expect(accountSchema.safeParse(contract).success).toBe(false);
    expect(contractSchema.safeParse(account).success).toBe(false);
    const corrupt = account.slice(0, 55) + (account.endsWith('A') ? 'B' : 'A');
    expect(accountSchema.safeParse(corrupt).success).toBe(false);
  });
  it('requires exact quote schema, decimal amount strings and Testnet', () => {
    const quote = { protocol: 'aegispay-402/1', quoteId: '939f4ead-5744-41e7-b20a-d18b39d38843', resourceKey: 'quick-signal:demo-parser:v1', network: 'stellar:testnet', assetContractId: StrKey.encodeContract(randomBytes(32)), merchantAddress: StrKey.encodeEd25519PublicKey(randomBytes(32)), amountStroops: '300000', expiresAt: '2026-11-08T00:00:00.000Z' };
    expect(quoteChallengeSchema.parse(quote)).toEqual(quote);
    for (const change of [{ network: 'mainnet' }, { amountStroops: 300000 }, { amountStroops: '0' }, { signedXdr: 'untrusted' }]) {
      expect(quoteChallengeSchema.safeParse({ ...quote, ...change }).success).toBe(false);
    }
  });
  it('tools carry only allowlisted identifiers and reject nested injection', () => {
    for (const value of [
      { tool: 'discover_offers', url: 'https://evil.test' },
      { tool: 'request_quote', resourceKey: 'quick-signal:demo-parser:v1', policy: { max: '999999' } },
      { tool: 'read_purchase', quoteId: 'not-a-uuid' },
    ]) expect(toolIntentSchema.safeParse(value).success).toBe(false);
  });
});
