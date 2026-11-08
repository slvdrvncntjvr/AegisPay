import 'server-only';
import { configuredStore } from '../../../../../../src/server/db/connection';
import { createApplication } from '../../../../../../src/server/http/application';
import { createWalletGateway } from '../../../../../../src/server/integrations/wallet-gateway';
import { safeError } from '../../../../../../src/server/http/boundaries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let application: ReturnType<typeof createApplication> | undefined;
async function handle(request: Request) {
  try {
    application ??= createApplication({ store: configuredStore(), env: process.env, wallet: () => createWalletGateway(process.env) });
    return await application(request);
  } catch (error) { return safeError(error); }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const PATCH = handle;

