/** Final read-only custody/session/count/bundle/hygiene audit after the stopped
 * qualification. This does not rerun or repair the failed application gate. */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { checkServerIdentity } from 'node:tls';
import { createStore } from '../../../src/server/db/connection.ts';
import { reportFixture } from '../../../src/server/merchant/reports.ts';

const root=process.cwd();
const out=path.join(root,'docs/evidence/finals-staging-app');
const digest=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const expected='feaa345c7d4172d22feb6dd8c92794128061a2f357b2e5372c0739138b6f8f85';
const check=(v:unknown,c:string)=>{if(!v)throw new Error(c);};
const parse=(s:string)=>Object.fromEntries(s.split(/\r?\n/).filter(l=>/^[A-Z][A-Z0-9_]*=/.test(l)).map(l=>{const i=l.indexOf('=');let v=l.slice(i+1).trim();if(v.startsWith('"')&&v.endsWith('"'))v=JSON.parse(v);else if(v.startsWith("'")&&v.endsWith("'"))v=v.slice(1,-1);return[l.slice(0,i),v];}));
async function files(base:string):Promise<string[]> {
  const result:string[]=[];
  for(const e of await readdir(base,{withFileTypes:true})) {
    const p=path.join(base,e.name);
    if(e.isDirectory()) result.push(...await files(p)); else if(e.isFile())result.push(p);
  }
  return result.sort();
}
const safe:Record<string,any>={started_at:new Date().toISOString(),purpose:'final read-only audit; failed TASK-019 gate remains unfinished',outcome:'failed',qualification_gate_outcome:'failed'};
let store:ReturnType<typeof createStore>|undefined;
const secrets=new Set<string>(),ips=new Set<string>();
const findings=['quick-signal:demo-parser:v1','deep-trace:demo-parser:v1'].flatMap(k=>reportFixture(k,'v1').findings);
function matches(raw:Buffer|string,fixtures:boolean) {
  const s=raw.toString();
  return {known_secret_matches:[...secrets].filter(v=>s.includes(v)||s.includes(encodeURIComponent(v))).length,
    full_provider_id_matches:(s.match(/\b(?:dpg|usr|tea|srv)-[a-z0-9]{10,}(?:-[a-z0-9]+)?\b/g)??[]).length,
    raw_dsn_matches:(s.match(/postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/g)??[]).length,
    client_ip_matches:[...ips].filter(v=>s.includes(v)).length,
    protected_fixture_matches:fixtures?findings.filter(v=>s.includes(v)||s.includes(JSON.stringify(v).slice(1,-1))).length:0};
}
try {
  check(process.argv.length===2,'NO_AUDIT_ARGUMENTS_ALLOWED');
  check(!Object.keys(process.env).some(k=>/^(?:https?_proxy|all_proxy|node_options|node_extra_ca_certs|node_tls_reject_unauthorized|pg.*)$/i.test(k)),'UNSAFE_ENVIRONMENT');
  const dbtext=await readFile(path.join(root,'.env.staging.local'),'utf8');
  const db=parse(dbtext);const u=new URL(db.DATABASE_URL);
  check(digest(db.RENDER_STAGING_POSTGRES_ID)===expected && db.RENDER_STAGING_CREATED_AT==='2026-11-10T11:55:40.452333Z'&&db.RENDER_STAGING_EXPIRES_AT==='2026-12-10T11:55:40.452333Z'&&Date.now()<Date.parse(db.RENDER_STAGING_EXPIRES_AT),'EXACT_RESOURCE_LIFECYCLE_FAILED');
  check(u.hostname===`${db.RENDER_STAGING_POSTGRES_ID}.singapore-postgres.render.com` && u.pathname==='/aegispay_finals_staging' && (!u.port||u.port==='5432') && [...u.searchParams].length===1 && u.searchParams.get('sslmode')==='verify-full','EXACT_STRICT_DSN_FAILED');
  for(const name of await readdir(root)) if(/^\.env(?:\..*)?$/.test(name)&&name!=='.env.example') {
    const env=parse(await readFile(path.join(root,name),'utf8'));
    for(const[k,v]of Object.entries(env))if(/(?:SECRET|TOKEN|PASSWORD|API_KEY|ENCRYPTION_KEY|RECEIPT_SIGNING_KEY|DATABASE_URL)$/.test(k)&&typeof v==='string'&&v.length>=12){secrets.add(v);if(/DATABASE_URL$/.test(k)){try{const url=new URL(v);if(url.password){secrets.add(url.password);secrets.add(decodeURIComponent(url.password));}}catch{}}}
  }
  const identity=JSON.parse(await readFile(path.join(root,'.fmd-work/staging-app-custody/independent-agent.json'),'utf8'));secrets.add(identity.agent_secret);
  const permit=await readFile(path.join(root,'.fmd-work/staging-ip-allow-permit.json'),'utf8');for(const ip of permit.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)??[])ips.add(ip);check(ips.size===1,'IP_SCAN_CONFIGURATION_FAILED');
  store=createStore(db.DATABASE_URL,'public',1);store.pool.on('error',()=>{});
  const client=await store.pool.connect();
  try {
    const stream=(client as any).connection.stream;
    check(stream.encrypted&&stream.authorized&&!checkServerIdentity(u.hostname,stream.getPeerCertificate()),'FINAL_READ_ONLY_TLS_FAILED');
    safe.tls={encrypted:true,authorized:true,hostname_verified:true,protocol:stream.getProtocol(),real_createStore:true,max_connections:1};
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout='5s'");
    const counts:Record<string,number>={};
    for(const name of ['owner','merchant','agent','resource','schema_migration','session','auth_throttle','agent_run','quote','payment_attempt','payment_evidence','entitlement','job','wallet_operation','merchant_claim','run_event','audit_event','payment_accept_key'])counts[name]=(await client.query(`SELECT count(*)::int AS count FROM "${name}"`)).rows[0].count;
    safe.final_counts=counts;
    for(const name of ['agent_run','quote','payment_attempt','payment_evidence','entitlement','job','wallet_operation','merchant_claim','run_event','audit_event','payment_accept_key'])check(counts[name]===0,'FINANCIAL_ROWS_PRESENT');
    safe.sessions=(await client.query('SELECT count(*)::int AS total, count(*) FILTER(WHERE revoked_at IS NOT NULL)::int AS revoked, count(*) FILTER(WHERE revoked_at IS NULL)::int AS unrevoked FROM session')).rows[0];
    check(safe.sessions.unrevoked===0,'SESSION_NOT_REVOKED');
    safe.login_throttles={};
    for(const role of ['owner','merchant']) {
      const result=(await client.query('SELECT attempts, expires_at > clock_timestamp() AS window_active FROM auth_throttle WHERE key_hash=$1',[digest('login:untrusted-proxy:'+role)])).rows[0];
      safe.login_throttles[role]=result;check(result.attempts<=5,'LOGIN_THROTTLE_LIMIT_EXCEEDED');
    }
    const agent=(await client.query('SELECT status,last_nonce,policy_max_stroops,policy_expires_at,policy_observed_ledger FROM agent')).rows[0];
    check(agent.status==='unprovisioned'&&agent.last_nonce==='0'&&agent.policy_max_stroops==='0'&&agent.policy_expires_at.getTime()===0&&agent.policy_observed_ledger===null,'STAGING_AGENT_STATE_CHANGED');
    safe.agent={status:agent.status,nonce:agent.last_nonce,policy_stroops:agent.policy_max_stroops,expiry_epoch:true,observed_ledger_null:true};
    safe.migration_history=(await client.query('SELECT name,sha256 FROM schema_migration ORDER BY name')).rows;
    await client.query('COMMIT');
  }finally{client.release();}
  await store.close();store=undefined;
  safe.original_staging_config_sha256=digest(await readFile(path.join(root,'.env.staging.local')));
  safe.original_staging_config_unchanged=safe.original_staging_config_sha256===digest(dbtext);
  const latest=JSON.parse(await readFile(path.join(out,'2026-11-10T12-41-01-076Z/result.json'),'utf8'));
  check(safe.original_staging_config_sha256===latest.configuration.original_staging_file_sha256,'ORIGINAL_CUSTODY_CHANGED');
  safe.last_gate_receipt='2026-11-10T12-41-01-076Z/result.json';safe.build_id_sha256=digest((await readFile(path.join(root,'apps/web/.next/BUILD_ID'),'utf8')).trim());
  check(safe.build_id_sha256===latest.build.build_id_sha256,'BUILD_CHANGED_AFTER_GATE');
  const appFiles=latest.source.files;
  check((await Promise.all(appFiles.map(async(f:any)=>digest(await readFile(path.join(root,f.path)))===f.sha256))).every(Boolean),'APP_SOURCE_CHANGED_AFTER_GATE');
  safe.source_sha256=latest.source.sha256;safe.source_files_verified=appFiles.length;
  const inventory=[];let serverFixtures=0,clientFixtures=0;
  for(const base of ['apps/web/.next/server','apps/web/.next/static'])for(const p of await files(path.join(root,base))) {
    const raw=await readFile(p);const hits=matches(raw,true);
    const isClient=base.endsWith('/static');
    if(isClient)clientFixtures+=hits.protected_fixture_matches;else serverFixtures+=hits.protected_fixture_matches;
    const {protected_fixture_matches,...privateHits}=hits;check(Object.values(privateHits).every(v=>v===0),'BUILD_SECRET_HYGIENE_FAILED');
    inventory.push({path:path.relative(root,p).replaceAll('\\','/'),bytes:raw.length,sha256:digest(raw),client:isClient,protected_fixture_matches});
  }
  check(clientFixtures===0,'CLIENT_FIXTURE_LEAK');
  safe.browser_bundle_boundary={server_fixture_matches:serverFixtures,client_fixture_matches:clientFixtures,all_client_assets_also_fetched_over_http:latest.client_asset_inventory.length,server_fixture_text_not_published:true};
  safe.build_inventory_sha256=digest(JSON.stringify(inventory));safe.build_inventory_files=inventory.length;
  await writeFile(path.join(out,'build-inventory.json'),JSON.stringify({files:inventory,sha256:safe.build_inventory_sha256},null,2)+'\n',{flag:'wx'});
  const publicInventory=[];
  for(const base of ['deployment/finals/staging-app','docs/evidence/finals-staging-app'])for(const p of await files(path.join(root,base))) {
    const raw=await readFile(p);const hits=matches(raw,true);check(Object.values(hits).every(v=>v===0),'PUBLIC_ARTIFACT_HYGIENE_FAILED');
    publicInventory.push({path:path.relative(root,p).replaceAll('\\','/'),bytes:raw.length,sha256:digest(raw)});
  }
  safe.public_inventory=publicInventory;safe.hygiene={known_secret_matches:0,full_provider_id_matches:0,raw_dsn_matches:0,client_ip_matches:0,protected_findings_matches:0,memory_only:true};
  const port=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$r=@(Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 3037 -State Listen -ErrorAction SilentlyContinue); Write-Output $r.Count"],{windowsHide:true,encoding:'utf8',env:{...process.env,PSModulePath:`${process.env.SystemRoot}/System32/WindowsPowerShell/v1.0/Modules`}});
  check(port.status===0&&port.stdout.trim()==='0','OWNED_PORT_STILL_LISTENING');safe.owned_port_no_listener=true;
  safe.outcome='passed';
}catch(e){safe.safe_failure=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'READ_ONLY_AUDIT_FAILED';}
finally{
  await store?.close().catch(()=>{});safe.finished_at=new Date().toISOString();
  const text=JSON.stringify(safe,null,2)+'\n';
  if(Object.values(matches(text,true)).some(v=>v!==0)){process.stdout.write('{"outcome":"failed","safe_failure":"AUDIT_OUTPUT_HYGIENE_FAILED"}\n');process.exitCode=1;}
  else{await writeFile(path.join(out,'final-readonly-audit.json'),text,{flag:'wx'});process.stdout.write(JSON.stringify({outcome:safe.outcome,qualification_gate_outcome:'failed',safe_failure:safe.safe_failure,report:'docs/evidence/finals-staging-app/final-readonly-audit.json'})+'\n');process.exitCode=safe.outcome==='passed'?0:1;}
}
