import assert from 'node:assert/strict';
import * as noir from '@noirx402/agent-sdk';
import * as velo from '@carts1024/velo-sdk';
import { Asset, Networks, rpc } from '@stellar/stellar-sdk';

assert.equal(process.versions.node, '24.22.1', 'Use the pinned Node runtime');
assert.ok(Object.keys(noir).length > 0);
assert.ok(Object.keys(velo).length > 0);
assert.equal(typeof rpc.Server, 'function');
assert.ok(Asset.native().contractId(Networks.TESTNET).startsWith('C'));
console.info(JSON.stringify({ gate: 'sdk-imports', status: 'passed', node: process.versions.node,
  noirExports: Object.keys(noir).sort(), veloExports: Object.keys(velo).sort(),
  network: 'testnet', note: 'Imports only; no live integration or payment evidence' }));
