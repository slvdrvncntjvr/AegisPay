import { Identifier } from './primitives';

const resources = new Map([
  ['quick-signal:demo-parser:v1', { name: 'QuickSignal', description: 'Fictional basic dependency report.' }],
  ['deep-trace:demo-parser:v1', { name: 'DeepTrace', description: 'Fictional extended dependency report.' }],
]);

// Exact-key aliases affect display only; quotes, payloads and saved identities stay intact.
export function resourceName(key: string) { return resources.get(key)?.name ?? key; }
export function resourceDescription(key: string, fallback: string) { return resources.get(key)?.description ?? fallback; }
export function ResourceIdentity({ resourceKey }: { resourceKey: string }) {
  return <details><summary>Resource identity</summary><Identifier label="Resource key" value={resourceKey} /></details>;
}
