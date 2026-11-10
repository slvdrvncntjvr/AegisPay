import { z } from 'zod';
import { equalSecret } from '../../../../src/server/auth/session.ts';
import { json, jsonBody, safeError } from '../../../../src/server/http/boundaries.ts';
import { deny } from '../../../../src/server/domain/purchases.ts';

// This endpoint only nudges the durable SQL queue. It accepts no payment intent.
export function workerIngress(token: string | undefined, wake: () => void) {
  return async (request: Request): Promise<Response> => {
    try {
      const path = new URL(request.url).pathname;
      if (path === '/health' && request.method === 'GET') return json({ status: 'ok', network: 'testnet' });
      if (path !== '/wake' || request.method !== 'POST') deny('NOT_FOUND');
      if (!token || token.length < 32) deny('DEPENDENCY_UNAVAILABLE');
      const auth = request.headers.get('authorization');
      if (!auth?.startsWith('Bearer ') || !equalSecret(auth.slice(7), token)) deny('AUTH_INVALID');
      // Machine-to-machine only; browser Origin requests are never accepted.
      if (request.headers.has('origin')) deny('ORIGIN_DENIED');
      z.strictObject({}).parse(await jsonBody(request, 1024));
      wake();
      return json({ status: 'queued' }, 202);
    } catch (error) { return safeError(error); }
  };
}
