/** Offline source publication closure; never stages, commits or publishes. */
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {ACCEPTED,PRIVATE,git,sha,check} from './common.mjs';
git(['merge-base','--is-ancestor',ACCEPTED,'HEAD']);
check(!(await readdir(PRIVATE)).some(n=>n.startsWith('permit-')||n.endsWith('-attempt.json')),'CANNOT_RESEAL_AFTER_REVIEW_OR_DISPATCH');
const prior=JSON.parse(await readFile('docs/evidence/finals-staging-app/completion-resume-2026-11-11T01-27Z/actual/result.json','utf8'));
function blob(p){const r=spawnSync('git',['show',ACCEPTED+':'+p],{windowsHide:true});check(r.status===0,'ACCEPTED_BLOB_UNAVAILABLE');const current=spawnSync('git',['show','HEAD:'+p],{windowsHide:true});check(current.status===0&&sha(current.stdout)===sha(r.stdout),'ACCEPTED_APPLICATION_OR_RUNTIME_BLOB_CHANGED');return{path:p,sha256:sha(r.stdout),git_blob_sha256:sha(r.stdout)};}
const application_files=prior.source.files.map(f=>blob(f.path));
const runtime_files=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.node-version','tsconfig.json','apps/web/package.json','apps/web/next.config.ts','apps/web/tsconfig.json','packages/shared/package.json','deployment/finals/staging-app/evidence-terminal.ts'].filter(p=>!application_files.some(f=>f.path===p)).map(blob);
check(application_files.length===72&&runtime_files.length===2&&sha(JSON.stringify(application_files))==='724b45046b27aed73a4d671b9cfe6fa30ede9d75a7b1411c65e3353e6b5e1a55','EXACT_ACCEPTED_APPLICATION_CLOSURE_REQUIRED');
const helper_files=[];
for(const name of (await readdir('deployment/finals/preview')).filter(n=>n!=='source-closure.json').sort()){
 const p='deployment/finals/preview/'+name,raw=await readFile(p),b=/\.(?:mjs|cjs|ts|json|md)$/.test(name)?Buffer.from(raw.toString('utf8').replaceAll('\r\n','\n')):raw;helper_files.push({path:p,sha256:sha(b),git_blob_sha256:sha(b)});
}
const manifest={accepted_commit:ACCEPTED,accepted_tree:git(['rev-parse',ACCEPTED+'^{tree}']),rehearsal_windows_source_sha256:prior.source.sha256,application_sha256:sha(JSON.stringify(application_files)),application_files,runtime_files,helper_files,delivery_commit:'coordinator must commit/publish reviewed helpers; no source publication performed',source_closure_permit_hash:'SHA-256 of this file with LF line endings; committed blob must equal it'};
await writeFile('deployment/finals/preview/source-closure.json',JSON.stringify(manifest,null,2)+'\n');
process.stdout.write(JSON.stringify({outcome:'sealed-preparation-only',application_files:application_files.length,runtime_files:runtime_files.length,helper_files:helper_files.length,source_closure_sha256:sha(await readFile('deployment/finals/preview/source-closure.json'))})+'\n');
