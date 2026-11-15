// Operational handoff only: no new run, quote, wallet preparation or payment.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { chromium } from '@playwright/test';
import { DIR, read, receipt, privateEnv } from './common.mjs';
if(process.argv.length!==3||process.argv[2]!=='--check-hosted-handoff'){
  console.log(JSON.stringify({status:'not_run',code:'EXPLICIT_HOSTED_HANDOFF_CHECK_REQUIRED'}));process.exitCode=2;
}else{
  let pool,browser;const sessions=[],checks=[];let passed=false;
  const result={scope:'actual-hosted-testnet-demo-operational-handoff',observedAt:new Date().toISOString(),newRuns:0,newQuotes:0,newFinancialHandoffs:0,fullProductionQualification:false};
  try{
    assert(process.env.NODE_TLS_REJECT_UNAUTHORIZED!=='0');
    const web=privateEnv('.env.release.hosted-web.local'),worker=privateEnv('.env.release.hosted-worker.local'),config=read(DIR+'/configured.json');
    assert.equal(web.APP_ORIGIN,config.origin);assert.equal(worker.RUN_TESTNET,'1');
    pool=new Pool({connectionString:web.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
    const financial=async()=>{
      const out={};for(const table of ['agent','agent_run','quote','payment_attempt','payment_evidence','entitlement','merchant_claim','wallet_operation','job']){
        const rows=(await pool.query(`SELECT to_jsonb(t)::text AS row FROM "${table}" t ORDER BY id`)).rows;
        out[table]=createHash('sha256').update(JSON.stringify(rows)).digest('hex');
      }return out;
    };
    const before=await financial();
    const secretValues=Object.entries({...web,...worker}).filter(([k,v])=>/SECRET|TOKEN|SIGNING_KEY|DATABASE_URL|API_KEY|ENCRYPTION_KEY/.test(k)&&!k.includes('PUBLIC')&&v.length>16).map(([,v])=>v);
    const check=(name,value)=>{checks.push({name,passed:!!value});assert(value);};
    async function request(origin,path,init={}){
      const response=await fetch(origin+path,{...init,redirect:'error',signal:AbortSignal.timeout(60000)});
      const setCookie=response.headers.get('set-cookie'),cookie=setCookie?.split(';')[0],token=cookie?.slice(cookie.indexOf('=')+1);
      if(token&&/^[A-Za-z0-9_-]{43}$/.test(token))sessions.push({cookie,hash:createHash('sha256').update(token).digest('hex')});
      const text=await response.text();check('response-excludes-service-secrets',!secretValues.some(v=>text.includes(v)));
      return{response,text,cookie,setCookie};
    }
    for(const [origin,path]of [[config.origin,'/api/health'],[config.workerOrigin,'/health']])check('https-health', (await request(origin,path)).response.status===200);
    check('anonymous-state-denied',(await request(config.origin,'/api/v1/state')).response.status===401);
    check('anonymous-worker-wake-denied',(await request(config.workerOrigin,'/wake',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).response.status===401);
    check('wrong-origin-login-denied',(await request(config.origin,'/api/session',{method:'POST',headers:{origin:'https://invalid.example','content-type':'application/json'},body:JSON.stringify({role:'owner',token:web.DEMO_OWNER_LOGIN_TOKEN})})).response.status===403);
    browser=await chromium.launch({headless:true,executablePath:'C:/Users/Vincent/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
    for(const role of ['owner','merchant']){
      const login=await request(config.origin,'/api/session',{method:'POST',headers:{origin:config.origin,'content-type':'application/json'},body:JSON.stringify({role,token:web[role==='owner'?'DEMO_OWNER_LOGIN_TOKEN':'DEMO_MERCHANT_LOGIN_TOKEN']})});
      check(role+'-login-secure-cookie',login.response.status===204&&login.cookie&&/Secure/i.test(login.setCookie)&&/HttpOnly/i.test(login.setCookie)&&/SameSite=Strict/i.test(login.setCookie));
      const stateResponse=await request(config.origin,'/api/v1/state',{headers:{cookie:login.cookie}});check(role+'-state',stateResponse.response.status===200);
      const state=JSON.parse(stateResponse.text);check(role+'-identity',state.role===role&&state.walletAddress===web[role==='owner'?'DEMO_OWNER_PUBLIC_KEY':'DEMO_MERCHANT_PUBLIC_KEY']);
      check(role+'-current-price',state.offers.find(o=>o.resourceKey==='quick-signal:demo-parser:v1')?.priceStroops==='400000');
      if(role==='owner'){
        check('preserved-completed-run',state.runs.some(r=>r.id==='8b0bd3bc-6276-40df-bfe3-3fbb2b9e5d20'&&r.status==='completed'&&r.spentStroops==='300000'));
        check('preserved-authorized-attempt',state.attempts.length===1&&state.attempts[0].status==='authorized'&&state.attempts[0].attemptId==='baeaf3b8-a857-4f75-a0c7-332889c0777a');
        const observed=await request(config.origin,'/api/v1/payment-attempts/baeaf3b8-a857-4f75-a0c7-332889c0777a',{headers:{cookie:login.cookie}});
        check('original-identity-receipt-recovery',observed.response.status===200&&JSON.parse(observed.text).receiptId==='07e80131-f11c-483e-b911-edbbab5b25ff');
        const metadata=await request(config.origin,'/api/v1/receipts/07e80131-f11c-483e-b911-edbbab5b25ff',{headers:{cookie:login.cookie}});
        const m=JSON.parse(metadata.text);check('preserved-receipt-metadata',metadata.response.status===200&&m.evidence.amountStroops==='300000'&&m.evidence.nonce==='1'&&m.validUntil==='2026-11-14T15:56:59.885Z'&&m.aegisReceipt===null);
        const expired=await request(config.origin,'/api/v1/receipts/07e80131-f11c-483e-b911-edbbab5b25ff/resource',{headers:{cookie:login.cookie}});
        check('original-report-window-not-extended',expired.response.status>=400&&JSON.parse(expired.text).error?.code==='ENTITLEMENT_EXPIRED');
      }else check('preserved-separate-claim',state.agent===undefined&&state.runs===undefined&&state.claims.length===1&&state.claims[0].status==='confirmed'&&state.claims[0].observedClaimAmountStroops==='300000');
      for(const viewport of [{width:1440,height:1080},{width:390,height:844}]){
        const context=await browser.newContext({viewport});const split=login.cookie.indexOf('=');
        await context.addCookies([{name:login.cookie.slice(0,split),value:login.cookie.slice(split+1),url:config.origin,secure:true,httpOnly:true,sameSite:'Strict'}]);
        const page=await context.newPage();await page.goto(config.origin+'/app',{waitUntil:'networkidle',timeout:60000});
        await page.getByRole('button',{name:'Check Freighter connection',exact:true}).waitFor();
        check(role+'-browser-'+viewport.width,await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
        await context.close();
      }
      const logout=await request(config.origin,'/api/session',{method:'DELETE',headers:{cookie:login.cookie,origin:config.origin}});check(role+'-logout',logout.response.status===204);
      check(role+'-revoked-cookie-denied',(await request(config.origin,'/api/v1/state',{headers:{cookie:login.cookie}})).response.status===401);
    }
    check('authenticated-worker-wake',(await request(config.workerOrigin,'/wake',{method:'POST',headers:{authorization:'Bearer '+worker.WORKER_WAKE_TOKEN,'content-type':'application/json'},body:'{}'})).response.status===202);
    const client=await pool.connect();try{check('actual-database-tls',client.connection.stream.encrypted&&client.connection.stream.authorized);}finally{client.release();}
    check('no-financial-state-changes',JSON.stringify(await financial())===JSON.stringify(before));
    passed=true;
  }catch{/* Fixed result only; never persist raw responses, reports or tokens. */}
  finally{
    await browser?.close();let revoked=0;
    if(pool){for(const session of sessions){await pool.query('UPDATE session SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE token_hash=$1',[session.hash]);revoked+=(await pool.query('SELECT count(*)::int AS n FROM session WHERE token_hash=$1 AND revoked_at IS NOT NULL',[session.hash])).rows[0].n;}await pool.end();}
    Object.assign(result,{status:passed&&sessions.length===2&&revoked===2?'passed':'failed',checks,testSessionsCreated:sessions.length,testSessionsRevoked:revoked});
    receipt('hosted-handoff-check',result);console.log(JSON.stringify({status:result.status,checks:checks.length,lastCheck:checks.at(-1),testSessionsRevoked:revoked,newFinancialHandoffs:0}));if(result.status!=='passed')process.exitCode=1;
  }
}
