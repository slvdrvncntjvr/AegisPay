/** Exact minimal web env + existing TLS observer, TCP only: no health/API/DB. */
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { ObservationProxy } from './proxy-capture.ts';
import { ProductionLaunch, requireFreePorts, minimalEnv } from './startup.ts';
import { exclusive, sha } from './evidence-terminal.ts';
import { FOLLOWUP } from './continuation.ts';
const root=process.cwd();const require=createRequire(import.meta.url);
const check=(v:unknown,c:string)=>{if(!v)throw new Error(c);};
const parse=(s:string)=>Object.fromEntries(s.split(/\r?\n/).filter(l=>/^[A-Z][A-Z0-9_]*=/.test(l)).map(l=>{const i=l.indexOf('=');let v=l.slice(i+1).trim();if(v.startsWith('"')&&v.endsWith('"'))v=JSON.parse(v);else if(v.startsWith("'")&&v.endsWith("'"))v=v.slice(1,-1);return[l.slice(0,i),v];}));
await mkdir(FOLLOWUP,{recursive:true});const n=(await readdir(FOLLOWUP)).filter(p=>/^startup-only-execution-\d\.json$/.test(p)).length+1;check(n<=2,'STARTUP_ONLY_LAUNCH_LIMIT');
await exclusive(FOLLOWUP+`/startup-only-execution-${n}.json`,JSON.stringify({at:new Date().toISOString(),kind:'owned startup-only TCP diagnosis; no HTTP/API/provider/DB request'})+'\n');
const report:Record<string,any>={outcome:'failed',started_at:new Date().toISOString(),launch:n,tcp_only:true,no_health_or_api_requests:true};
let child:ProductionLaunch|undefined,proxy:ObservationProxy|undefined;let logs='';const secrets=new Set<string>(),ips=new Set<string>();
try{
  check(process.argv.length===2,'NO_STARTUP_ARGUMENTS');await requireFreePorts();
  const text=await readFile('.env.staging.web.local','utf8');const web=parse(text);
  const prior=JSON.parse(await readFile('.fmd-work/staging-app-custody/initial-fresh-schema.json','utf8'));check(sha(text)===prior.web_sha256,'WEB_CUSTODY_MISMATCH');
  const expected=['NODE_ENV','APP_ORIGIN','DATABASE_URL','DEMO_OWNER_PUBLIC_KEY','DEMO_MERCHANT_PUBLIC_KEY','NOIR_DEVICE_REGISTRY_ID','NOIR_AGENT_REGISTRY_ID','NOIR_PAYMENT_ESCROW_ID','NOIR_XLM_SAC_ID','STELLAR_NETWORK','STELLAR_NETWORK_PASSPHRASE','DEMO_AGENT_PUBLIC_KEY','DEMO_DEVICE_HASH','DEMO_OWNER_LOGIN_TOKEN','DEMO_MERCHANT_LOGIN_TOKEN','RECEIPT_SIGNING_KEY'];
  check(Object.keys(web).sort().join(',')===expected.sort().join(',')&&web.APP_ORIGIN==='http://127.0.0.1:3037'&&web.NODE_ENV==='production','EXACT_WEB_ENVIRONMENT_REQUIRED');
  for(const name of await readdir('.'))if(/^\.env(?:\..*)?$/.test(name)&&name!=='.env.example')for(const[k,v]of Object.entries(parse(await readFile(name,'utf8'))))if(/(?:SECRET|TOKEN|PASSWORD|API_KEY|ENCRYPTION_KEY|RECEIPT_SIGNING_KEY|DATABASE_URL)$/.test(k)&&v.length>=12){secrets.add(v);if(/DATABASE_URL$/.test(k)){const u=new URL(v);if(u.password){secrets.add(u.password);secrets.add(decodeURIComponent(u.password));}}}
  for(const file of ['.fmd-work/staging-ip-allow-permit.json','.fmd-work/staging-ip-rotation-permit-2026-11-10.json'])for(const ip of (await readFile(file,'utf8')).match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)??[])ips.add(ip);
  check(ips.size===2,'IP_HYGIENE_SET_FAILED');
  const env=minimalEnv(web);report.web_config_sha256=sha(text);report.environment_keys=Object.keys(env).sort();
  child=new ProductionLaunch(require.resolve('next/dist/bin/next'),path.join(root,'deployment/finals/staging-app/tls-observer.cjs'),path.join(root,'apps/web'),env,s=>{logs+=s;});
  proxy=new ObservationProxy(3038,()=>{throw new Error('STARTUP_HTTP_UNEXPECTED');});await proxy.start(3037);
  report.startup=await child.wait();
  check(report.startup.classification==='READY','STARTUP_ONLY_NOT_READY');check(report.startup.staging_tls_observations===0&&proxy.summary().upstream_requests===0,'STARTUP_ONLY_SENT_UNEXPECTED_REQUEST');
  report.outcome='passed';
}catch(e){report.safe_failure=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'STARTUP_ONLY_DIAGNOSIS_FAILED';}
finally{
  if(child)report.pre_cleanup=child.snapshot();
  await proxy?.close().catch(()=>{report.outcome='failed';report.proxy_cleanup_failed=true;});if(proxy)report.proxy=proxy.summary();
  if(child){report.cleanup=await child.stop();if(!report.cleanup.owned_process_exited)report.outcome='failed';}
  report.log_hygiene={known_secret_matches:[...secrets].filter(v=>logs.includes(v)||logs.includes(encodeURIComponent(v))).length,client_ip_matches:[...ips].filter(v=>logs.includes(v)).length,full_provider_id_matches:(logs.match(/\b(?:dpg|usr|tea|srv)-[a-z0-9]{10,}(?:-[a-z0-9]+)?\b/g)??[]).length,raw_dsn_matches:(logs.match(/postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/g)??[]).length};
  if(Object.values(report.log_hygiene).some(v=>v!==0))report.outcome='failed';
  report.finished_at=new Date().toISOString();await exclusive(FOLLOWUP+`/startup-only-${n}.json`,JSON.stringify(report,null,2)+'\n');
  process.stdout.write(JSON.stringify({outcome:report.outcome,classification:report.startup?.classification,safe_failure:report.safe_failure,probes:report.startup?.probes,report:FOLLOWUP+`/startup-only-${n}.json`})+'\n');process.exitCode=report.outcome==='passed'?0:1;
}
