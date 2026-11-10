// SERVER/WORKER ONLY. Fictional fixtures never enter public HTML or client imports.
import { deny } from '../domain/purchases.ts';
const fixtures: Record<string, { title: string; label: string; findings: string[] }> = {
  'quick-signal:demo-parser:v1': { title: 'QuickSignal · demo-parser', label: 'Fictional demonstration report; no live security intelligence', findings: ['AEGIS_PRIVATE_QUICKSIGNAL_V1: the fictional demo-parser 1.2 fixture uses an unchecked archive path.', 'For this invented scenario, constrain extraction to a temporary directory and reject parent-path traversal.'] },
  'deep-trace:demo-parser:v1': { title: 'DeepTrace · demo-parser', label: 'Fictional demonstration report; no live security intelligence', findings: ['AEGIS_PRIVATE_DEEPTRACE_V1: the invented fixture has a dependency-origin ambiguity in its build manifest.', 'This fictional analysis recommends pinning dependency integrity and verifying archive paths before extraction.', 'These authored sample findings are not facts about a real package.'] },
};
export function reportFixture(key: string, version: string) {
  if (version !== 'v1' || !fixtures[key]) deny('NOT_FOUND');
  return fixtures[key]!;
}
