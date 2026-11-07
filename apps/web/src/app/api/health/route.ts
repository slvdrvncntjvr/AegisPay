import { runtimeHealth } from '../../../runtime.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json(runtimeHealth(), { headers: { 'Cache-Control': 'no-store' } });
}
