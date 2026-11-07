import { z } from 'zod';

export const MAX_AMOUNT = (1n << 127n) - 1n;
export const MAX_NONCE = (1n << 64n) - 1n;
const decimal = z.string().max(39).regex(/^(0|[1-9][0-9]*)$/);
export const unsignedAmountSchema = decimal.pipe(z.string().refine(v => BigInt(v) <= MAX_AMOUNT));
export const amountSchema = unsignedAmountSchema.pipe(z.string().refine(v => BigInt(v) > 0n));
export const nonceSchema = decimal.pipe(z.string().refine(v => BigInt(v) <= MAX_NONCE));
export const uuidSchema = z.uuid();
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export function xlmToStroops(value: string): bigint {
  if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,7})?$/.test(value) || value.length > 47) throw new Error('INVALID_AMOUNT');
  const [whole, fraction = ''] = value.split('.');
  const result = BigInt(whole!) * 10000000n + BigInt(fraction.padEnd(7, '0'));
  amountSchema.parse(result.toString());
  return result;
}
export function stroopsToXlm(value: bigint): string {
  unsignedAmountSchema.parse(value.toString());
  return `${value / 10000000n}.${(value % 10000000n).toString().padStart(7, '0')}`;
}

// StrKey checksum validation without importing signing/network SDKs into clients.
function validStrKey(value: string, version: number): boolean {
  if (!/^[A-Z2-7]{56}$/.test(value)) return false;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes: number[] = [];
  let bits = 0, buffer = 0;
  for (const char of value) {
    buffer = (buffer << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >>> bits) & 255); }
  }
  if (bytes.length !== 35 || bytes[0] !== version) return false;
  let crc = 0;
  for (const byte of bytes.slice(0, 33)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return bytes[33] === (crc & 255) && bytes[34] === (crc >>> 8);
}
export const accountSchema = z.string().refine(v => validStrKey(v, 6 << 3), 'INVALID_ACCOUNT');
export const contractSchema = z.string().refine(v => validStrKey(v, 2 << 3), 'INVALID_CONTRACT');
export const resourceKeySchema = z.enum(['quick-signal:demo-parser:v1', 'deep-trace:demo-parser:v1']);
export const healthSchema = z.strictObject({ status: z.literal('ok'), network: z.literal('testnet') });
export const toolIntentSchema = z.discriminatedUnion('tool', [
  z.strictObject({ tool: z.literal('discover_offers') }),
  z.strictObject({ tool: z.literal('request_quote'), resourceKey: resourceKeySchema }),
  z.strictObject({ tool: z.literal('purchase_quote'), quoteId: uuidSchema }),
  z.strictObject({ tool: z.literal('read_purchase'), quoteId: uuidSchema }),
]);
export type ToolIntent = z.infer<typeof toolIntentSchema>;
export const quoteChallengeSchema = z.strictObject({
  protocol: z.literal('aegispay-402/1'), quoteId: uuidSchema, resourceKey: resourceKeySchema,
  network: z.literal('stellar:testnet'), assetContractId: contractSchema,
  amountStroops: amountSchema, merchantAddress: accountSchema, expiresAt: z.iso.datetime(),
});
export type QuoteChallenge = z.infer<typeof quoteChallengeSchema>;
export const attemptStatuses = ['accepted', 'preparing', 'signed', 'sponsoring', 'reserved', 'submitting', 'submitted', 'authorized', 'unknown', 'refused', 'expired', 'failed', 'manual_review'] as const;
export const attemptStatusSchema = z.enum(attemptStatuses);
export type AttemptStatus = z.infer<typeof attemptStatusSchema>;
