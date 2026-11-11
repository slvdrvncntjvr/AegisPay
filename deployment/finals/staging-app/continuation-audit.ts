/** New continuation audit: integrity/hygiene plus independent read-only exact-DB
 * verification ONLY after the one actual gate passed. Never reruns that gate. */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { checkServerIdentity } from 'node:tls';
import { createStore } from '../../../src/server/db/connection.ts';
import { reportFixture } from '../../../src/server/merchant/reports.ts';
import { FOLLOWUP } from './continuation.ts';
const digest=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const check=(v:unknown,c:string)=>{if(!v)throw new Error(c);};
const parse=(s:string)=>Object.fromEntries(s.split(/\r?\n/).filter(l=>/^[A-Z][A-Z0-9_]*=/.test(l)).map(l=>{const i=l.indexOf('=');let v=l.slice(i+1).trim();if(v.startsWith('"')&&v.endsWith('"'))v=JSON.parse(v);else if(v.startsWith("'")&&v.endsWith("'"))v=v.slice(1,-1);return[l.slice(0,i),v];}));
async function files(base:string):Promise<string[]> {const a:string[]=[];for(const e of await readdir(base,{withFileTypes:true})){const p=path.join(base,e.name);if(e.isDirectory())a.push(...await files(p));else if(e.isFile())a.push(p);}return a;}
const report:Record<string,any>={started_at:new Date().toISOString(),outcome:'failed',kind:'new bounded continuation integrity/hygiene audit; independent read-only database audit only after actual gate passed',capture_preflight:'see immutable preflight receipts',actual_staging_rerun_attempted:false,actual_staging_exit:null};
const secrets=new Set<string>(),ips=new Set<string>();
const findings=['quick-signal:demo-parser:v1','deep-trace:demo-parser:v1'].flatMap(k=>reportFixture(k,'v1').findings);
function matches(b:Buffer|string){const s=b.toString();return{known_secret_matches:[...secrets].filter(v=>s.includes(v)||s.includes(encodeURIComponent(v))).length,full_provider_id_matches:(s.match(/\b(?:dpg|usr|tea|srv)-[a-z0-9]{10,}(?:-[a-z0-9]+)?\b/g)??[]).length,raw_dsn_matches:(s.match(/postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/g)??[]).length,client_ip_matches:[...ips].filter(v=>s.includes(v)).length,protected_fixture_matches:findings.filter(v=>s.includes(v)||s.includes(JSON.stringify(v).slice(1,-1))).length};}
try{
  check(process.argv.length===2,'NO_AUDIT_ARGUMENTS_ALLOWED');
  const baseline=JSON.parse(await readFile(FOLLOWUP+'/preserved-baseline.json','utf8'));
  for(const f of baseline.public_files)check(digest(await readFile(f.path))===f.sha256,'HISTORICAL_ARTIFACT_CHANGED');
  report.preserved_original_public_files=baseline.public_files.length;
  const custody=[...await files('.fmd-work/staging-app-custody'),'.env.staging.local','.env.staging.web.local','.fmd-work/staging-ip-allow-permit.json','.fmd-work/staging-ip-rotation-permit-2026-11-10.json'];
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
  for(const ip of (await readFile('.fmd-work/staging-ip-rotation-permit-2026-11-10.json','utf8')).match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)??[])ips.add(ip);
  check(ips.size===2,'OLD_AND_NEW_IP_SCAN_CONFIGURATION_FAILED');
  let serverFixtures=0,clientFixtures=0;
  for(const f of build.files){const raw=await readFile(f.path);const hits=matches(raw);const{protected_fixture_matches,...privateHits}=hits;check(Object.values(privateHits).every(v=>v===0),'BUILD_PRIVATE_DATA_HYGIENE_FAILED');if(f.client)clientFixtures+=protected_fixture_matches;else serverFixtures+=protected_fixture_matches;}
  check(clientFixtures===0&&serverFixtures>0,'CLIENT_SERVER_FIXTURE_BOUNDARY_FAILED');
  report.bundle_boundary={server_fixture_matches:serverFixtures,client_fixture_matches:clientFixtures,source_build_files_unchanged:true};report.application_source_files=original.source.files;report.build_files=build.files;
  const inventory=[];
  for(const p of [...await files('deployment/finals/staging-app'),...await files('docs/evidence/finals-staging-app')]){const b=await readFile(p);check(Object.values(matches(b)).every(v=>v===0),'PUBLIC_EVIDENCE_HYGIENE_FAILED');inventory.push({path:p.replaceAll('\\','/'),bytes:b.length,sha256:digest(b)});}
  report.hygiene={known_secret_matches:0,full_provider_id_matches:0,raw_dsn_matches:0,client_ip_matches:0,protected_fixture_matches:0,raw_values_memory_only:true};report.inventory=inventory;
  const port=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$r=@(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 3037,3038 -State Listen -ErrorAction SilentlyContinue); Write-Output $r.Count"],{windowsHide:true,encoding:'utf8',env:{...process.env,PSModulePath:`${process.env.SystemRoot}/System32/WindowsPowerShell/v1.0/Modules`}});
  check(port.status===0&&port.stdout.trim()==='0','APP_OR_PROXY_PORT_LISTENER_PRESENT');report.app_and_proxy_ports_no_listener=true;
  const actualPath=FOLLOWUP+'/actual/result.json'; let actual; try {actual=JSON.parse(await readFile(actualPath,'utf8'));}catch{}
  const preflights=[];for(const name of (await readdir(FOLLOWUP)).filter(n=>/^preflight-[1-3]\.json$/.test(n)).sort()){const receipt=JSON.parse(await readFile(FOLLOWUP+'/'+name,'utf8'));preflights.push({path:FOLLOWUP+'/'+name,sha256:digest(await readFile(FOLLOWUP+'/'+name)),outcome:receipt.outcome,safe_failure:receipt.safe_failure??null,contexts:receipt.contexts.length});}
  report.capture_preflight=preflights;report.actual_staging_rerun_attempted=!!actual; report.actual_staging_exit=actual?(actual.outcome==='passed'?0:1):null; report.actual_staging_outcome=actual?.outcome??'not_attempted';
  report.actual_staging_safe_failure=actual?.safe_failure??null;report.actual_staging_failed_stage=actual?.failed_stage??null;report.actual_http_checks=actual?.http.length??0;report.actual_browser_cases=actual?.browser.length??0;
  if(actual)report.final_database_checkpoint_from_actual_receipt={path:actualPath,sha256:digest(await readFile(actualPath)),counts:actual.cleanup?.final_allowlisted_counts??null,sessions:actual.cleanup?.sessions??null,independent_new_database_observation:false};
  if(actual?.outcome==='passed'){
    check(actual.browser.length===4&&actual.sessions.created_this_invocation===6&&actual.sessions.unrevoked===0,'ACTUAL_SUCCESS_EVIDENCE_INCOMPLETE');
    const db=parse(await readFile('.env.staging.local','utf8'));const u=new URL(db.DATABASE_URL);
    check(digest(db.RENDER_STAGING_POSTGRES_ID)==='feaa345c7d4172d22feb6dd8c92794128061a2f357b2e5372c0739138b6f8f85'&&u.hostname===`${db.RENDER_STAGING_POSTGRES_ID}.singapore-postgres.render.com`&&u.pathname==='/aegispay_finals_staging'&&[...u.searchParams].length===1&&u.searchParams.get('sslmode')==='verify-full','EXACT_DATABASE_AUDIT_CONFIGURATION_FAILED');
    const store=createStore(db.DATABASE_URL,'public',1);store.pool.on('error',()=>{});
    try{
      const client=await store.pool.connect();
      try{
        const stream=(client as any).connection.stream;
        check(stream.encrypted&&stream.authorized&&!checkServerIdentity(u.hostname,stream.getPeerCertificate()),'INDEPENDENT_AUDIT_TLS_FAILED');
        await client.query('BEGIN READ ONLY');await client.query("SET LOCAL statement_timeout='5s'");
        report.independent_database_audit={read_only:true,tls:{encrypted:true,authorized:true,hostname_verified:true,protocol:stream.getProtocol(),pool_max:1},database_time:((await client.query('SELECT clock_timestamp() AS now')).rows[0].now as Date).toISOString(),counts:{}};
        for(const name of ['owner','merchant','agent','resource','schema_migration','session','auth_throttle','agent_run','quote','payment_attempt','payment_evidence','entitlement','job','wallet_operation','merchant_claim','run_event','audit_event','payment_accept_key'])report.independent_database_audit.counts[name]=(await client.query(`SELECT count(*)::int AS count FROM "${name}"`)).rows[0].count;
        const counts=report.independent_database_audit.counts;
        check(counts.owner===1&&counts.merchant===1&&counts.agent===1&&counts.resource===2&&counts.schema_migration===4,'INDEPENDENT_AUDIT_METADATA_COUNTS_FAILED');
        for(const name of ['agent_run','quote','payment_attempt','payment_evidence','entitlement','job','wallet_operation','merchant_claim','run_event','audit_event','payment_accept_key'])check(counts[name]===0,'INDEPENDENT_AUDIT_FINANCIAL_ROWS_PRESENT');
        const sessions=(await client.query('SELECT count(*)::int AS total,count(*) FILTER(WHERE revoked_at IS NOT NULL)::int AS revoked,count(*) FILTER(WHERE revoked_at IS NULL)::int AS unrevoked FROM session')).rows[0];
        check(sessions.total===actual.sessions.total&&sessions.unrevoked===0,'INDEPENDENT_AUDIT_SESSION_REVOCATION_FAILED');report.independent_database_audit.sessions=sessions;
        const agent=(await client.query('SELECT status,last_nonce,policy_max_stroops,policy_expires_at,policy_observed_ledger FROM agent')).rows[0];
        check(agent.status==='unprovisioned'&&agent.last_nonce==='0'&&agent.policy_max_stroops==='0'&&agent.policy_expires_at.getTime()===0&&agent.policy_observed_ledger===null,'INDEPENDENT_AUDIT_AGENT_CHANGED');
        report.independent_database_audit.agent={status:agent.status,nonce:agent.last_nonce,policy_stroops:agent.policy_max_stroops,expiry_epoch:true,observed_ledger_null:true};
        const migrations=(await client.query('SELECT name,sha256 FROM schema_migration ORDER BY name')).rows;check(JSON.stringify(migrations)===JSON.stringify(actual.migrations),'INDEPENDENT_AUDIT_MIGRATION_HISTORY_CHANGED');
        report.independent_database_audit.login_throttles={};
        for(const role of ['owner','merchant']){const row=(await client.query('SELECT attempts,expires_at,expires_at>clock_timestamp() AS window_active FROM auth_throttle WHERE key_hash=$1',[digest('login:untrusted-proxy:'+role)])).rows[0];check(row&&row.attempts<=5,'INDEPENDENT_AUDIT_LOGIN_LIMIT_EXCEEDED');report.independent_database_audit.login_throttles[role]={attempts:row.attempts,window_active:row.window_active,expires_at:row.expires_at.toISOString()};}
        await client.query('COMMIT');
      }finally{client.release();}
    }finally{await store.close();}
  }else report.independent_database_audit={attempted:false,reason:'actual gate failed or absent; no diagnostic reconnect or second gate'};
  report.outcome='passed';
}catch(e){report.safe_failure=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'OFFLINE_AUDIT_FAILED';}
report.finished_at=new Date().toISOString();
const text=JSON.stringify(report,null,2)+'\n';
if(Object.values(matches(text)).some(v=>v!==0)){process.stdout.write('{"outcome":"failed","safe_failure":"AUDIT_OUTPUT_HYGIENE_FAILED"}\n');process.exitCode=1;}
else{await writeFile(FOLLOWUP+'/final-continuation-audit.json',text,{flag:'wx'});process.stdout.write(JSON.stringify({outcome:report.outcome,safe_failure:report.safe_failure,report:FOLLOWUP+'/final-continuation-audit.json'})+'\n');process.exitCode=report.outcome==='passed'?0:1;}
