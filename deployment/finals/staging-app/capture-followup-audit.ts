/** Offline audit after failed synthetic preflight. Opens no DB/provider/login. */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { reportFixture } from '../../../src/server/merchant/reports.ts';
import { FOLLOWUP } from './capture.ts';
const digest=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const check=(v:unknown,c:string)=>{if(!v)throw new Error(c);};
const parse=(s:string)=>Object.fromEntries(s.split(/\r?\n/).filter(l=>/^[A-Z][A-Z0-9_]*=/.test(l)).map(l=>{const i=l.indexOf('=');let v=l.slice(i+1).trim();if(v.startsWith('"')&&v.endsWith('"'))v=JSON.parse(v);else if(v.startsWith("'")&&v.endsWith("'"))v=v.slice(1,-1);return[l.slice(0,i),v];}));
async function files(base:string):Promise<string[]> {const a:string[]=[];for(const e of await readdir(base,{withFileTypes:true})){const p=path.join(base,e.name);if(e.isDirectory())a.push(...await files(p));else if(e.isFile())a.push(p);}return a;}
const report:Record<string,any>={started_at:new Date().toISOString(),outcome:'failed',kind:'offline followup integrity and hygiene audit; no new database observation',capture_preflight:'failed',actual_staging_rerun_attempted:false,actual_staging_exit:null};
const secrets=new Set<string>(),ips=new Set<string>();
const findings=['quick-signal:demo-parser:v1','deep-trace:demo-parser:v1'].flatMap(k=>reportFixture(k,'v1').findings);
function matches(b:Buffer|string){const s=b.toString();return{known_secret_matches:[...secrets].filter(v=>s.includes(v)||s.includes(encodeURIComponent(v))).length,full_provider_id_matches:(s.match(/\b(?:dpg|usr|tea|srv)-[a-z0-9]{10,}(?:-[a-z0-9]+)?\b/g)??[]).length,raw_dsn_matches:(s.match(/postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/g)??[]).length,client_ip_matches:[...ips].filter(v=>s.includes(v)).length,protected_fixture_matches:findings.filter(v=>s.includes(v)||s.includes(JSON.stringify(v).slice(1,-1))).length};}
try{
  check(process.argv.length===2,'NO_AUDIT_ARGUMENTS_ALLOWED');
  const baseline=JSON.parse(await readFile(FOLLOWUP+'/preserved-baseline.json','utf8'));
  for(const f of baseline.public_files)check(digest(await readFile(f.path))===f.sha256,'HISTORICAL_ARTIFACT_CHANGED');
  report.preserved_original_public_files=baseline.public_files.length;
  const custody=[...await files('.fmd-work/staging-app-custody'),'.env.staging.local','.env.staging.web.local'];
  const privateHashes=[];for(const p of custody)privateHashes.push({path:p,sha256:digest(await readFile(p))});
  check(digest(JSON.stringify(privateHashes))===baseline.custody_aggregate_sha256,'CUSTODY_CHANGED');
  report.custody_files_unchanged=custody.length;
  const original=JSON.parse(await readFile('docs/evidence/finals-staging-app/2026-11-10T12-41-01-076Z/result.json','utf8'));
  for(const f of original.source.files)check(digest(await readFile(f.path))===f.sha256,'APPLICATION_SOURCE_CHANGED');
  report.source_files_unchanged=original.source.files.length;report.source_sha256=original.source.sha256;
  check(digest((await readFile('apps/web/.next/BUILD_ID','utf8')).trim())===original.build.build_id_sha256,'APPLICATION_BUILD_ID_CHANGED');
  report.build_id_sha256=original.build.build_id_sha256;
  const build=JSON.parse(await readFile('docs/evidence/finals-staging-app/build-inventory.json','utf8'));
  for(const f of build.files)check(digest(await readFile(f.path))===f.sha256,'APPLICATION_BUILD_CHANGED');
  report.build_files_unchanged=build.files.length;report.build_inventory_sha256=build.sha256;
  for(const name of await readdir('.'))if(/^\.env(?:\..*)?$/.test(name)&&name!=='.env.example')for(const[k,v]of Object.entries(parse(await readFile(name,'utf8'))))if(/(?:SECRET|TOKEN|PASSWORD|API_KEY|ENCRYPTION_KEY|RECEIPT_SIGNING_KEY|DATABASE_URL)$/.test(k)&&v.length>=12){secrets.add(v);if(/DATABASE_URL$/.test(k)){const u=new URL(v);if(u.password){secrets.add(u.password);secrets.add(decodeURIComponent(u.password));}}}
  secrets.add(JSON.parse(await readFile('.fmd-work/staging-app-custody/independent-agent.json','utf8')).agent_secret);
  for(const ip of (await readFile('.fmd-work/staging-ip-allow-permit.json','utf8')).match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)??[])ips.add(ip);
  check(ips.size===1,'IP_SCAN_CONFIGURATION_FAILED');
  const inventory=[];
  for(const p of [...await files('deployment/finals/staging-app'),...await files('docs/evidence/finals-staging-app')]){const b=await readFile(p);check(Object.values(matches(b)).every(v=>v===0),'PUBLIC_EVIDENCE_HYGIENE_FAILED');inventory.push({path:p.replaceAll('\\','/'),bytes:b.length,sha256:digest(b)});}
  report.hygiene={known_secret_matches:0,full_provider_id_matches:0,raw_dsn_matches:0,client_ip_matches:0,protected_fixture_matches:0,raw_values_memory_only:true};report.inventory=inventory;
  const port=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$r=@(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 3037 -State Listen -ErrorAction SilentlyContinue); Write-Output $r.Count"],{windowsHide:true,encoding:'utf8',env:{...process.env,PSModulePath:`${process.env.SystemRoot}/System32/WindowsPowerShell/v1.0/Modules`}});
  check(port.status===0&&port.stdout.trim()==='0','APP_PORT_LISTENER_PRESENT');report.app_port_no_listener=true;
  report.outcome='passed';
}catch(e){report.safe_failure=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'OFFLINE_AUDIT_FAILED';}
report.finished_at=new Date().toISOString();
const text=JSON.stringify(report,null,2)+'\n';
if(Object.values(matches(text)).some(v=>v!==0)){process.stdout.write('{"outcome":"failed","safe_failure":"AUDIT_OUTPUT_HYGIENE_FAILED"}\n');process.exitCode=1;}
else{await writeFile(FOLLOWUP+'/final-offline-audit.json',text,{flag:'wx'});process.stdout.write(JSON.stringify({outcome:report.outcome,safe_failure:report.safe_failure,report:FOLLOWUP+'/final-offline-audit.json'})+'\n');process.exitCode=report.outcome==='passed'?0:1;}
