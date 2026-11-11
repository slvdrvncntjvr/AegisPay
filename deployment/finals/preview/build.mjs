/** Host-only, coordinator-approved build; never run in the preparation handoff. */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sha=b=>createHash('sha256').update(b).digest('hex');
const check=(v,c)=>{if(!v)throw Error(c);};
check(process.env.AEGIS_PREVIEW_ENABLED==='1','PREVIEW_INITIAL_BUILD_FENCED');
check(process.version==='v24.22.1'&&process.env.RENDER_GIT_COMMIT===process.env.AEGIS_PREVIEW_COMMIT&&/^[a-f0-9]{40}$/.test(process.env.AEGIS_PREVIEW_COMMIT??''),'PINNED_RUNTIME_SOURCE_REQUIRED');
const clean={};for(const key of ['PATH','HOME','TMPDIR','TMP','TEMP','SystemRoot'])if(process.env[key])clean[key]=process.env[key];
Object.assign(clean,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'});
for(const args of [['--yes','pnpm@12.18.0','install','--frozen-lockfile','--prod=false'],['--yes','pnpm@12.18.0','--filter','@aegispay/web','build']]){
 const child=spawnSync(process.platform==='win32'?'npx.cmd':'npx',args,{env:clean,stdio:'inherit',windowsHide:true});check(child.status===0,'FROZEN_INSTALL_OR_WEB_BUILD_FAILED');
}
const manifest=JSON.parse(await readFile('deployment/finals/preview/source-closure.json','utf8'));
for(const f of [...manifest.application_files,...manifest.runtime_files,...manifest.helper_files])check(sha(await readFile(f.path))===f.sha256,'ACCEPTED_SOURCE_OR_HELPER_CHANGED');
check(sha(JSON.stringify(manifest.application_files))===manifest.application_sha256,'CANONICAL_APPLICATION_CLOSURE_CHANGED');
const require=createRequire(import.meta.url);
for(const [name,version]of Object.entries({next:'16.4.5',react:'19.3.1','react-dom':'19.3.1',pg:'8.23.1'}))check(require(name+'/package.json').version===version,'INSTALLED_PACKAGE_VERSION_CHANGED');
const {tsImport}=await import('tsx/esm/api');
const {reportFixture}=await tsImport('../../../src/server/merchant/reports.ts',import.meta.url);
const markers=['quick-signal:demo-parser:v1','deep-trace:demo-parser:v1'].flatMap(k=>reportFixture(k,'v1').findings);
const secrets=Object.entries(process.env).filter(([k,v])=>/(?:SECRET|TOKEN|PASSWORD|API_KEY|ENCRYPTION_KEY|RECEIPT_SIGNING_KEY|DATABASE_URL)$/.test(k)&&v.length>=12).map(([,v])=>v);
async function files(p){const a=[];for(const e of await readdir(p,{withFileTypes:true})){const q=p+'/'+e.name;if(e.isDirectory())a.push(...await files(q));else if(e.isFile())a.push(q);}return a;}
const assets=[];for(const p of await files('apps/web/.next/static')){const b=await readFile(p),s=b.toString();check(![...markers,...secrets].some(v=>s.includes(v)||s.includes(encodeURIComponent(v))||s.includes(JSON.stringify(v).slice(1,-1))),'CLIENT_BUNDLE_PRIVATE_LEAK');assets.push({path:'/_next/static/'+p.slice('apps/web/.next/static/'.length),sha256:sha(b),bytes:b.length});}
const receipt={kind:'build',commit:process.env.RENDER_GIT_COMMIT,source_closure_sha256:manifest.application_sha256,build_id_sha256:sha((await readFile('apps/web/.next/BUILD_ID','utf8')).trim()),node:process.version,private_env_forwarded_to_install_or_next_build:false,assets};
await writeFile('apps/web/.next/preview-build.json',JSON.stringify(receipt));
process.stdout.write('[preview-attestation]'+JSON.stringify(receipt)+'\n');
