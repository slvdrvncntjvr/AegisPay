import { healthSchema, toolIntentSchema } from '@aegispay/shared';

export function runtimeHealth() {
  return healthSchema.parse({ status: 'ok', network: 'testnet' });
}

// Shared protocol consumption at the server boundary; no agent/signing dependency.
export function parseToolIntent(input: unknown) { return toolIntentSchema.parse(input); }
