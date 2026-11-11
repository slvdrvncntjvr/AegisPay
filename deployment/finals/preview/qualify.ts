/** Prepared remote HTTPS gate. Never invoked during the preparation handoff. */
import { readFile,mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { checkServerIdentity } from 'node:tls';
import { expect,type Browser } from '@playwright/test';
import {launchReviewedBrowser} from './browser.mjs';
import {OriginalResponses} from './original-responses.mjs';
import {SessionTracking,fetchWithSessionTracking} from './session-tracking.mjs';
import { createStore } from '../../../src/server/db/connection.ts';
import { reportFixture } from '../../../src/server/merchant/reports.ts';
import { PRIVATE,OUT,DBHASH,NAME,check,sha,exclusive,envFile,jsonGET,safe,cleanNetworkEnvironment } from './common.mjs';
// Reuse the accepted terminal protocol through its runtime module boundary.
const {publishTerminal}=await import(new URL('../staging-app/evidence-terminal.ts',import.meta.url).href);

const directory=OUT+'/qualification';
const result:any={started_at:new Date().toISOString(),outcome:'failed',scope:'separate real HTTPS Free preview; no financial/model/worker actions',http:[],browser:[],cleanup:{},body_capture:{scans:0,bytes:0,missing_bodies:0}};
let store:ReturnType<typeof createStore>|undefined;
const tokens=new Set<string>(),secrets=new Set<string>();
const privateIPs=new Set<string>();
const sessionTracking=new SessionTracking(tokens,secrets);
let browser:Browser|undefined;
const captures:any[]=[];
const findings=['quick-signal:demo-parser:v1','deep-trace:demo-parser:v1'].flatMap(k=>reportFixture(k,'v1').findings);
let phase='private-permit';
function scan(bytes:Buffer|string,count=true){const s=bytes.toString();if(count){result.body_capture.scans++;result.body_capture.bytes+=Buffer.byteLength(bytes);}check(![...findings,...secrets].some(v=>s.includes(v)||s.includes(encodeURIComponent(v))||s.includes(JSON.stringify(v).slice(1,-1)))&&![...privateIPs].some(v=>s.includes(v))&&!/postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/.test(s)&&!(/\b(?:dpg|usr|tea|srv)-[a-z0-9]{10,}(?:-[a-z0-9]+)?\b/.test(s)),'REMOTE_RESPONSE_PRIVATE_LEAK');}
const financial=['agent_run','quote','payment_attempt','payment_evidence','entitlement','job','wallet_operation','merchant_claim','run_event','audit_event','payment_accept_key'];
async function dbSnapshot(){
 const c=await store!.pool.connect();try{
  const stream=(c as any).connection.stream,host=new URL((await envFile('.env.staging.local')).DATABASE_URL!).hostname;
  check(stream.encrypted&&stream.authorized&&!checkServerIdentity(host,stream.getPeerCertificate())&&(checkServerIdentity('preview.invalid',stream.getPeerCertificate()) as NodeJS.ErrnoException|undefined)?.code==='ERR_TLS_CERT_ALTNAME_INVALID','QUALIFICATION_HELPER_STRICT_TLS_FAILED');
  await c.query('BEGIN READ ONLY');await c.query("SET LOCAL statement_timeout='5s'");
  const now=(await c.query('SELECT clock_timestamp() AS now')).rows[0].now as Date;
  const counts:Record<string,number>={};for(const name of [...financial,'owner','merchant','agent','resource','schema_migration','session'])counts[name]=(await c.query(`SELECT count(*)::int AS count FROM "${name}"`)).rows[0].count;
  for(const name of financial)check(counts[name]===0,'FINANCIAL_OR_EXECUTION_ROWS_PRESENT');
  check(counts.owner===1&&counts.merchant===1&&counts.agent===1&&counts.resource===2&&counts.schema_migration===4,'STAGING_METADATA_CHANGED');
  const sessions=(await c.query('SELECT count(*)::int AS total,count(*) FILTER(WHERE revoked_at IS NULL)::int AS unrevoked FROM session')).rows[0];
  const agent=(await c.query('SELECT public_key,device_hash,status,last_nonce,policy_max_stroops,policy_expires_at,policy_observed_ledger FROM agent')).rows[0];
  check(agent.status==='unprovisioned'&&agent.last_nonce==='0'&&agent.policy_max_stroops==='0'&&agent.policy_expires_at.getTime()===0&&agent.policy_observed_ledger===null,'AGENT_NOT_EMPTY_UNPROVISIONED');
  const budget:any={};for(const [role,key,limit,required]of [['owner','login:untrusted-proxy:owner',5,3],['merchant','login:untrusted-proxy:merchant',5,3],['global','login:global',50,6]] as const){const row=(await c.query('SELECT attempts,expires_at FROM auth_throttle WHERE key_hash=$1',[sha(key)])).rows[0];budget[role]={remaining:row&&row.expires_at>now?limit-row.attempts:limit,required};}
  const migrations=(await c.query('SELECT name,sha256 FROM schema_migration ORDER BY name')).rows;
  await c.query('COMMIT');return{at:now.toISOString(),counts,sessions,budget,migrations,agent_identity:{public_key_sha256:sha(agent.public_key),device_hash_sha256:sha(agent.device_hash)},helper_tls:{encrypted:true,authorized:true,hostname_verified:true,wrong_hostname_rejected:true,protocol:stream.getProtocol()}};
 }finally{c.release();}
}
try{
 cleanNetworkEnvironment();
 const permit=JSON.parse(await readFile(PRIVATE+'/permit-qualify.json','utf8'));
 check(permit.coordinator_reviewed===true&&permit.operation==='qualify'&&Date.parse(permit.expires_at)>Date.now(),'REMOTE_QUALIFICATION_PERMIT_REQUIRED');
 await mkdir(directory,{recursive:true});await exclusive(directory+'/execution.json',{started_at:result.started_at,permit_sha256:sha(await readFile(PRIVATE+'/permit-qualify.json'))});
 phase='reviewed-browser-prerequisite';
 const launched=await launchReviewedBrowser();browser=launched.browser;result.browser_identity=launched.identity;
 check(permit.browser_sha256===launched.identity.sha256,'REVIEWED_BROWSER_BINARY_CHANGED');
 const config=JSON.parse(await readFile(PRIVATE+'/preview-environment.json','utf8'));
 const spec=JSON.parse(await readFile('deployment/finals/preview/environment.json','utf8'));
 const requiredNames=[...Object.keys(spec.fixed),...spec.provider_verified,...spec.private_external_verify_full,...spec.copy_only_public_staging_values,...spec.generate_independent_48_byte_base64url_after_review].sort();
 check(JSON.stringify(Object.keys(config).sort())===JSON.stringify(requiredNames)&&!spec.forbidden.some((k:string)=>k in config)&&!Object.keys(config).some(k=>k.startsWith('NEXT_PUBLIC_')),'EXACT_NO_MODEL_OR_WORKER_ENVIRONMENT_REQUIRED');
 const custody=JSON.parse(await readFile(PRIVATE+'/provider-readonly.json','utf8'));
 const owned=JSON.parse(await readFile(PRIVATE+'/owned-service.json','utf8'));
 const deployment=JSON.parse(await readFile(PRIVATE+'/owned-deploy.json','utf8'));
 check(owned.name===NAME&&owned.id===permit.expected_service_id&&owned.id===deployment.serviceId&&owned.origin===config.APP_ORIGIN&&owned.origin===permit.expected_origin&&deployment.commit===permit.source_commit&&sha(custody.databaseId)===DBHASH,'EXACT_PREVIEW_PROVIDER_CUSTODY_FAILED');
 const origin=new URL(owned.origin);check(origin.protocol==='https:'&&origin.origin===owned.origin&&origin.hostname.endsWith('.onrender.com'),'EXACT_PREVIEW_HTTPS_REQUIRED');
 for(const name of ['.env.staging.local','.env.staging.web.local','.env.worker.local','.env.deploy.local','.env.spike.local']){try{for(const[k,v]of Object.entries(await envFile(name)))if(/(?:SECRET|TOKEN|PASSWORD|API_KEY|ENCRYPTION_KEY|RECEIPT_SIGNING_KEY|DATABASE_URL)$/.test(k)&&typeof v==='string'&&v.length>=12){secrets.add(v);if(k==='DATABASE_URL'){const u=new URL(v);secrets.add(u.password);secrets.add(decodeURIComponent(u.password));}}}catch(e){if((e as any)?.code!=='ENOENT')throw e;}}
 for(const[k,v]of Object.entries(config))if(/TOKEN|RECEIPT_SIGNING_KEY|DATABASE_URL/.test(k)&&typeof v==='string'){secrets.add(v);if(k==='DATABASE_URL'){const u=new URL(v);secrets.add(u.password);secrets.add(decodeURIComponent(u.password));}}
 for(const p of ['.fmd-work/staging-ip-allow-permit.json','.fmd-work/staging-ip-rotation-permit-2026-11-10.json','.fmd-work/staging-ip-rotation-permit-2026-11-11.json'])for(const ip of (await readFile(p,'utf8')).match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)??[])privateIPs.add(ip);
 const deploy=await envFile('.env.deploy.local'),auth={Authorization:'Bearer '+deploy.RENDER_API_KEY};
 const providerGET=(p:string)=>jsonGET('https://api.render.com/v1'+p,auth);
 phase='provider-source-environment';
 const service=await providerGET('/services/'+encodeURIComponent(owned.id));
 check(service.id===owned.id&&service.ownerId===custody.ownerId&&service.name===NAME&&service.serviceDetails.plan==='free'&&service.serviceDetails.region==='singapore'&&service.serviceDetails.url===owned.origin&&service.autoDeployTrigger==='off'&&service.serviceDetails.numInstances===1,'PROVIDER_PREVIEW_SETTINGS_MISMATCH');
 const dep=await providerGET('/services/'+owned.id+'/deploys/'+deployment.id);
 check(dep.status==='live'&&dep.commit?.id===permit.source_commit,'LIVE_EXACT_SOURCE_DEPLOY_REQUIRED');
 const vars=await providerGET('/services/'+owned.id+'/env-vars?limit=100');
 check(Array.isArray(vars)&&vars.length<100,'PREVIEW_ENV_INVENTORY_INCOMPLETE');
 const actual=Object.fromEntries(vars.map((v:any)=>[v.envVar.key,v.envVar.value]));
 check(JSON.stringify(Object.keys(actual).sort())===JSON.stringify(Object.keys(config).sort())&&Object.keys(config).every(k=>actual[k]===config[k]),'EXACT_PREVIEW_ENVIRONMENT_MISMATCH');
 result.provider={service_sha256:sha(owned.id),origin:owned.origin,source_commit:permit.source_commit,plan:'free',region:'singapore',auto_deploy:'off',environment_names:Object.keys(config).sort()};
 phase='database-before-login';
 const db=await envFile('.env.staging.local');store=createStore(db.DATABASE_URL!,'public',1);store.pool.on('error',()=>{});
 result.before=await dbSnapshot();check(Number.isSafeInteger(permit.prior_revoked_sessions)&&permit.prior_revoked_sessions>=16&&result.before.sessions.total===permit.prior_revoked_sessions&&result.before.sessions.unrevoked===0,'REVIEWED_PRIOR_REVOKED_SESSION_CHECKPOINT_REQUIRED');
 const prior=JSON.parse(await readFile('docs/evidence/finals-staging-app/completion-resume-2026-11-11T01-27Z/actual/result.json','utf8'));check(JSON.stringify(result.before.migrations)===JSON.stringify(prior.migrations),'ACCEPTED_MIGRATION_HISTORY_CHANGED');
 for(const b of Object.values(result.before.budget) as any[])check(b.remaining>=b.required,'NATURAL_LOGIN_BUDGET_INSUFFICIENT');
 check(result.before.agent_identity.public_key_sha256===sha(config.DEMO_AGENT_PUBLIC_KEY)&&result.before.agent_identity.device_hash_sha256===sha(config.DEMO_DEVICE_HASH),'PREVIEW_AGENT_IDENTITY_MISMATCH');
 const request=async(p:string,options:RequestInit={},expected=200)=>{
  const r=await fetchWithSessionTracking(owned.origin+p,{...options,redirect:'manual',signal:AbortSignal.timeout(20000)},sessionTracking);const body=Buffer.from(await r.arrayBuffer());scan(body);
  result.http.push({path_category:p.startsWith('/_next/static/')?'STATIC':p.split('?')[0],method:options.method??'GET',status:r.status,bytes:body.length,sha256:sha(body)});
  check(r.status===expected,'HTTPS_HTTP_STATUS_MISMATCH');if(p.startsWith('/api/'))check(r.headers.get('cache-control')==='no-store','API_NO_STORE_REQUIRED');return{r,body,json:()=>JSON.parse(body.toString())};
 };
 phase='bounded-cold-readiness';
 const deadline=Date.now()+180000;let ready=false,probes=0;while(Date.now()<deadline&&probes<12){probes++;try{const r=await fetch(owned.origin+'/api/health',{redirect:'manual',signal:AbortSignal.timeout(15000)});const b=Buffer.from(await r.arrayBuffer());scan(b);if(r.status===200&&JSON.parse(b.toString()).network==='testnet'){ready=true;break;}}catch(e){if((e as Error).message==='REMOTE_RESPONSE_PRIVATE_LEAK')throw e;}await new Promise(r=>setTimeout(r,5000));}check(ready,'BOUNDED_COLD_READINESS_FAILED');result.readiness={ready,probes,deadline_ms:180000};
 for(const p of ['/','/login','/app'])await request(p);
 const require=createRequire(import.meta.url),rsc=new URL(owned.origin+'/app');await require('next/dist/client/components/router-reducer/set-cache-busting-search-param').setCacheBustingSearchParam(rsc,{RSC:'1'});
 const shell=await request(rsc.pathname+rsc.search,{headers:{RSC:'1'}});check(shell.r.headers.get('content-type')?.startsWith('text/x-component'),'ACTUAL_RSC_REQUIRED');
 for(const p of ['/api/session','/api/v1/state','/api/v1/catalog'])await request(p,{},401);
 await request('/api/v1/state',{headers:{Cookie:'aegispay_session=invalid'}},401);
 for(const badOrigin of ['https://qualification.invalid','http://'+origin.hostname])await request('/api/session',{method:'POST',headers:{Origin:badOrigin,'Content-Type':'application/json'},body:'{"role":"owner","token":"invalid"}'},403);
 await request('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"role":"owner","token":"invalid"}'},403);
 const stateCheck=(s:any,role:string)=>{check(s.role===role&&s.network==='testnet'&&s.offers.length===2&&s.walletAddress===config[role==='owner'?'DEMO_OWNER_PUBLIC_KEY':'DEMO_MERCHANT_PUBLIC_KEY']&&s.walletOperations.length===0,'ROLE_STATE_MISMATCH');if(role==='owner')check(s.agent.publicKey===config.DEMO_AGENT_PUBLIC_KEY&&s.agent.deviceHash===config.DEMO_DEVICE_HASH&&s.agent.status==='unprovisioned'&&s.agent.policyMaxStroops==='0'&&s.agent.policyObservedLedger===null&&s.runs.length===0&&s.attempts.length===0,'OWNER_EMPTY_UNPROVISIONED_REQUIRED');else check(!s.agent&&!s.runs&&!s.attempts&&s.claims.length===0,'MERCHANT_PRIVACY_FAILED');};
 phase='actual-https-auth';
 for(const role of ['owner','merchant']){
  const login=await request('/api/session',{method:'POST',headers:{Origin:owned.origin,'Content-Type':'application/json'},body:JSON.stringify({role,token:config[role==='owner'?'DEMO_OWNER_LOGIN_TOKEN':'DEMO_MERCHANT_LOGIN_TOKEN']})},204);
  const set=login.r.headers.get('set-cookie')??'';check(/HttpOnly/i.test(set)&&/; Secure/i.test(set)&&/SameSite=Strict/i.test(set)&&/Max-Age=28800/.test(set),'HTTPS_SECURE_STRICT_COOKIE_REQUIRED');
  const cookie=set.split(';')[0]!,token=cookie.slice(cookie.indexOf('=')+1);check(/^[A-Za-z0-9_-]{43}$/.test(token),'SESSION_TOKEN_SHAPE_FAILED');tokens.add(sha(token));secrets.add(token);
  stateCheck((await request('/api/v1/state',{headers:{Cookie:cookie}})).json(),role);
  await request('/api/v1/catalog',{headers:{Cookie:cookie}},role==='owner'?200:403);
  await request('/api/session',{method:'DELETE',headers:{Cookie:cookie,Origin:'https://qualification.invalid'}},403);
  stateCheck((await request('/api/v1/state',{headers:{Cookie:cookie}})).json(),role);
  const logout=await request('/api/session',{method:'DELETE',headers:{Cookie:cookie,Origin:owned.origin}},204);check(/Max-Age=0/.test(logout.r.headers.get('set-cookie')??''),'LOGOUT_COOKIE_NOT_CLEARED');await request('/api/v1/state',{headers:{Cookie:cookie}},401);
 }
 const logs=async()=>providerGET('/logs?'+new URLSearchParams({ownerId:custody.ownerId,resource:owned.id,startTime:deployment.createdAt,endTime:new Date().toISOString(),direction:'backward',text:'preview-attestation',limit:'100'}));
 const attestations=(data:any)=>{check(data.hasMore!==true,'ATTESTATION_LOG_WINDOW_INCOMPLETE');const rows=data.logs??data;check(Array.isArray(rows),'PROVIDER_LOG_SCHEMA_CHANGED');return rows.map((v:any)=>String(v.message??'')).filter((m:string)=>m.startsWith('[preview-attestation]')).map((m:string)=>JSON.parse(m.slice('[preview-attestation]'.length))).filter((v:any)=>v.commit===permit.source_commit);};
 phase='remote-build-assets';const build=attestations(await logs()).filter((v:any)=>v.kind==='build');check(build.length===1&&build[0].assets.length>0&&build[0].source_closure_sha256===JSON.parse(await readFile('deployment/finals/preview/source-closure.json','utf8')).application_sha256,'EXACT_REMOTE_BUILD_RECEIPT_REQUIRED');
 result.build=build[0];for(const a of build[0].assets){check(/^\/_next\/static\/[A-Za-z0-9_./-]+$/.test(a.path)&&!a.path.includes('..'),'UNSAFE_BUILD_ASSET_PATH');const response=await request(a.path);check(sha(response.body)===a.sha256&&response.body.length===a.bytes,'DEPLOYED_ASSET_BUILD_MISMATCH');}
 phase='actual-https-browser';
 try{for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}])for(const role of ['owner','merchant']){
  const context=await browser!.newContext({viewport:{width:viewport.width,height:viewport.height},serviceWorkers:'block'});
  let pageErrors=0;
  const page=await context.newPage();page.on('pageerror',()=>pageErrors++);
  const capture=new OriginalResponses(owned.origin,scan,sessionTracking,(r:any)=>{const u=new URL(r.url);return u.origin===owned.origin&&(r.method==='GET'||r.url===owned.origin+'/api/session')&&!/wallet-state|wallet-operations|payment-attempts|\/demo\/|\/runs(?:\/|$)/.test(u.pathname);});
  captures.push(capture);await capture.attach(context,page);
  const drain=()=>capture.drain();
  try{
   await page.goto(owned.origin+'/app');await expect(page).toHaveURL(/\/login\?expired=1$/);await drain();
   await page.getByRole('combobox',{name:'Role',exact:true}).selectOption(role);await page.getByLabel('Demo access token').fill(config[role==='owner'?'DEMO_OWNER_LOGIN_TOKEN':'DEMO_MERCHANT_LOGIN_TOKEN']);
   await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(owned.origin+'/app');await expect(page.getByText('Authenticated database snapshot',{exact:false})).toBeVisible();
   if(role==='owner')await expect(page.getByRole('button',{name:'Start task',exact:true})).toBeDisabled();else await expect(page.getByRole('heading',{level:1})).toHaveText('Your terms. Your claim.');
   const cookie=(await context.cookies()).find(c=>c.name==='aegispay_session');if(cookie&&/^[A-Za-z0-9_-]{43}$/.test(cookie.value)){tokens.add(sha(cookie.value));secrets.add(cookie.value);}check(cookie?.httpOnly&&cookie.secure&&cookie.sameSite==='Strict','BROWSER_HTTPS_COOKIE_FAILED');
   const state=await page.evaluate(async()=>({state:await(await fetch('/api/v1/state',{cache:'no-store'})).json(),storage:JSON.stringify({...localStorage,...sessionStorage}),html:document.documentElement.outerHTML,cookie:document.cookie}));stateCheck(state.state,role);scan(state.storage);scan(state.html);check(!state.cookie.includes('aegispay_session'),'BROWSER_COOKIE_NOT_HTTPONLY');await drain();
   await page.reload();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'HORIZONTAL_OVERFLOW');await drain();
   await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(owned.origin+'/login');await drain();check(!(await context.cookies()).some(c=>c.name==='aegispay_session'),'BROWSER_LOGOUT_COOKIE_RETAINED');
   await request('/api/v1/state',{headers:{Cookie:'aegispay_session='+cookie!.value}},401);check(pageErrors===0,'BROWSER_NETWORK_OR_RUNTIME_FAILED');
   result.browser.push({viewport:viewport.name,role,real_https:true,real_login:true,real_state:true,reload:true,logout_revoked:true,original_response_capture:capture.summary(),page_errors:pageErrors,raw_exports:false,route_response_mocks:false});
  }finally{
   await drain().catch(()=>{result.browser_capture_failure=true;});await context.close();await capture.settleAfterClose();
   const finalCapture=capture.summary();(result.browser_capture_cleanup??=[]).push({viewport:viewport.name,role,...finalCapture});
   if(finalCapture.failures||finalCapture.pending||finalCapture.missing_entities||!finalCapture.exact_request_maps||finalCapture.covered!==finalCapture.requests)result.browser_capture_failure=true;
  }
 }}finally{await browser!.close();browser=undefined;}
 check(result.browser.length===4&&!result.browser_capture_failure,'BROWSER_MATRIX_INCOMPLETE');
 phase='actual-app-pool-tls';const tls=attestations(await logs()).filter((v:any)=>v.kind==='app_pool_tls');check(tls.length>0&&tls.every((v:any)=>v.resource_matches&&v.encrypted&&v.authorized&&v.hostname_verified&&v.wrong_hostname_rejected&&v.strict_configuration&&v.pool_max===10),'ACTUAL_APP_POOL_STRICT_TLS_REQUIRED');result.app_pool_tls=tls;
 phase='final-database';result.after=await dbSnapshot();check(result.after.sessions.total===result.before.sessions.total+6&&result.after.sessions.unrevoked===0&&tokens.size===6&&sessionTracking.summary().uncertain_commits===0&&JSON.stringify(result.before.migrations)===JSON.stringify(result.after.migrations),'FINAL_SESSIONS_OR_MIGRATIONS_MISMATCH');result.outcome='passed';
}catch(e){result.safe_failure=safe(e);result.failed_phase=phase;}
finally{
 if(browser)await browser.close().catch(()=>{result.outcome='failed';});
 await Promise.allSettled(captures.map(c=>c.settleAfterClose()));
 result.cleanup.session_capture=sessionTracking.summary();
 if(result.cleanup.session_capture.uncertain_commits){result.cleanup.uncertain_session_commit=true;result.outcome='failed';}
 if(store){try{if(tokens.size)await store.pool.query('UPDATE session SET revoked_at=clock_timestamp() WHERE token_hash=ANY($1::text[]) AND revoked_at IS NULL',[[...tokens]]);result.cleanup.database=await dbSnapshot();check(result.cleanup.database.sessions.unrevoked===0,'UNREVOKED_TEST_SESSION');}catch{result.cleanup.database_failed=true;result.outcome='failed';}await store.close();}
 result.finished_at=new Date().toISOString();await mkdir(directory,{recursive:true});
 try{const t=await publishTerminal(directory,result,[],(text:string)=>scan(text,false));process.stdout.write(JSON.stringify({outcome:result.outcome,report:directory+'/result.json',safe_failure:result.safe_failure,finalization_sha256:t.finalization_sha256,requires_external_observed_exit:true})+'\n');}catch{process.stdout.write('{"outcome":"failed","safe_failure":"TERMINAL_PUBLICATION_FAILED"}\n');result.outcome='failed';}
 process.exitCode=result.outcome==='passed'?0:1;
}
