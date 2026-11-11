/** Offline source publication closure; never stages, commits or publishes. */
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {ACCEPTED,PRIVATE,git,sha,check} from './common.mjs';
check(git(['rev-parse','HEAD'])===ACCEPTED,'ACCEPTED_HEAD_CHANGED');
check(!(await readdir(PRIVATE)).some(n=>n.startsWith('permit-')||n.endsWith('-attempt.json')),'CANNOT_RESEAL_AFTER_REVIEW_OR_DISPATCH');
const prior=JSON.parse(await readFile('docs/evidence/finals-staging-app/completion-resume-2026-11-11T01-27Z/actual/result.json','utf8'));
function blob(p){const r=spawnSync('git',['show',ACCEPTED+':'+p],{windowsHide:true});check(r.status===0,'ACCEPTED_BLOB_UNAVAILABLE');return{path:p,sha256:sha(r.stdout),git_blob_sha256:sha(r.stdout)};}
const application_files=prior.source.files.map(f=>blob(f.path));
const runtime_files=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.node-version','tsconfig.json','apps/web/package.json','apps/web/next.config.ts','apps/web/tsconfig.json','packages/shared/package.json','deployment/finals/staging-app/evidence-terminal.ts'].filter(p=>!application_files.some(f=>f.path===p)).map(blob);
const helper_files=[];
for(const name of (await readdir('deployment/finals/preview')).filter(n=>n!=='source-closure.json').sort()){
 const p='deployment/finals/preview/'+name,b=(await readFile(p,'utf8')).replaceAll('\r\n','\n');helper_files.push({path:p,sha256:sha(b),git_blob_sha256:sha(b)});
}
const manifest={accepted_commit:ACCEPTED,accepted_tree:git(['rev-parse',ACCEPTED+'^{tree}']),rehearsal_windows_source_sha256:prior.source.sha256,application_sha256:sha(JSON.stringify(application_files)),application_files,runtime_files,helper_files,delivery_commit:'coordinator must commit/publish reviewed helpers; no source publication performed',source_closure_permit_hash:'SHA-256 of this file with LF line endings; committed blob must equal it'};
await writeFile('deployment/finals/preview/source-closure.json',JSON.stringify(manifest,null,2)+'\n');
process.stdout.write(JSON.stringify({outcome:'sealed-preparation-only',application_files:application_files.length,runtime_files:runtime_files.length,helper_files:helper_files.length,source_closure_sha256:sha(await readFile('deployment/finals/preview/source-closure.json'))})+'\n');
