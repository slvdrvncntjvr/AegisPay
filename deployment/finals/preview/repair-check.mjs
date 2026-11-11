/** Owned loopback fixture only; no real login, DB or provider operation. */
import http from 'node:http';
import {mkdir,readdir,readFile} from 'node:fs/promises';
import {launchReviewedBrowser} from './browser.mjs';
import {SessionTracking,fetchWithSessionTracking} from './session-tracking.mjs';
import {OriginalResponses,validateEntity} from './original-responses.mjs';
import {check,sha,exclusive} from './common.mjs';
const OUT='docs/evidence/finals-preview/repair-2026-11-11';
const report={started_at:new Date().toISOString(),outcome:'failed',scope:'synthetic original-response and header-identity regression',real_logins:0,sql_statements:0,provider_calls:0,cases:[]};
const counts=new Map(),syntheticSessions=new Map();
for(let i=0;i<16;i++)syntheticSessions.set(sha('synthetic prior revoked '+i),true);
const priorState=[...syntheticSessions];
const tokens=new Set(),secrets=new Set(),tracking=new SessionTracking(tokens,secrets);
let releaseSlow;const slowRequested=new Promise(r=>{releaseSlow=r;});
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://loopback.invalid');counts.set(req.method+' '+p.pathname,(counts.get(req.method+' '+p.pathname)??0)+1);
 if(p.pathname==='/api/session'){
  const token=(p.searchParams.get('case')==='cache'?'A':p.searchParams.get('case')==='flags'?'B':'C').repeat(43);syntheticSessions.set(sha(token),false);
  res.writeHead(204,{'set-cookie':'aegispay_session='+token+'; Path=/','cache-control':'public'});res.end();return;
 }
 if(p.pathname==='/slow'){res.writeHead(200,{'content-type':'text/plain','content-length':'14'});res.flushHeaders();releaseSlow();setTimeout(()=>res.end('slow synthetic'),600);return;}
 if(p.pathname==='/redirect'){res.writeHead(302,{Location:'/fast','content-length':'0'});res.end();return;}
 if(p.pathname==='/no-content'||p.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
 if(p.pathname==='/empty'){res.writeHead(200,{'content-length':'0'});res.end();return;}
 if(p.pathname==='/head'){res.writeHead(200,{'content-length':'512'});res.end();return;}
 const body=p.pathname==='/entity'?'original synthetic entity':'<!doctype html><html><head><link rel="icon" href="data:,"></head><body>synthetic</body></html>';
 res.writeHead(200,{'content-type':p.pathname==='/entity'?'text/plain':'text/html','content-length':String(Buffer.byteLength(body))});res.end(body);
});
let browser;
await mkdir(OUT,{recursive:true});
const attempt=(await readdir(OUT)).filter(n=>/^regression-\d+\.json$/.test(n)).length+1;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const launched=await launchReviewedBrowser();browser=launched.browser;report.browser=launched.identity;
 const scanned=[];
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 const capture=new OriginalResponses(origin,b=>scanned.push(sha(b)),tracking,r=>new URL(r.url).origin===origin);
 await capture.attach(context,page);
 await page.goto(origin+'/');
 await page.evaluate(async()=>{await fetch('/entity');await fetch('/empty');await fetch('/no-content');await fetch('/head',{method:'HEAD'});});
 await page.goto(origin+'/redirect');await page.goto(origin+'/');await capture.drain();
 const good=capture.summary();
 check(good.exact_request_maps&&good.missing_entities===0&&good.failures===0&&good.original_entities>=4&&good.declared_empty_entities===1&&good.non_entities>=2&&good.redirect_headers_only===1,'ORIGINAL_RESPONSE_MATRIX_FAILED');
 check(counts.get('GET /entity')===1&&scanned.includes(sha('original synthetic entity')),'ORIGINAL_ENTITY_NOT_SCANNED_EXACTLY_ONCE');
 check([...counts.values()].reduce((a,n)=>a+n,0)===good.requests,'UNEXPECTED_FIXTURE_NETWORK_REPLAY');
 check(!Object.keys(good.commands).some(n=>/loadNetworkResource|fulfillRequest|Network.getResponseBody/.test(n)),'FORBIDDEN_REPLAY_OR_SUBSTITUTION');
 report.original_responses=good;report.cases.push('original body captured without later GET','real 204 and HEAD explicitly non-entity','declared zero-length 200 captured','redirect identity followed with headers-only accounting','fast navigation retains captured entity');
 const mismatch=await capture.paused({requestId:'synthetic-foreign',networkId:'synthetic-foreign',request:{method:'GET',url:origin+'/entity'},responseStatusCode:200,responseHeaders:[]}).then(()=>false,()=>true);
 check(mismatch,'FOREIGN_RESPONSE_IDENTITY_ACCEPTED');report.cases.push('foreign response identity refused');
 for(const [name,body,headers]of [['undeclared empty',Buffer.alloc(0),[]],['nonzero declared empty',Buffer.alloc(0),[{name:'Content-Length',value:'5'}]],['zero-length mismatch',Buffer.from('x'),[{name:'Content-Length',value:'0'}]]]){let refused=false;try{validateEntity('GET',200,headers,body);}catch{refused=true;}check(refused,'UNJUSTIFIED_EMPTY_OR_MISMATCH_ACCEPTED');report.cases.push(name+' refused');}
 await context.close();await capture.settleAfterClose();

 const cancelContext=await browser.newContext({serviceWorkers:'block'}),cancelPage=await cancelContext.newPage();
 const canceled=new OriginalResponses(origin,()=>{},tracking,r=>new URL(r.url).origin===origin);await canceled.attach(cancelContext,cancelPage);await cancelPage.goto(origin+'/');
 await cancelPage.evaluate(()=>{globalThis.fixtureAbort=new AbortController();globalThis.fixtureRequest=fetch('/slow',{signal:globalThis.fixtureAbort.signal}).catch(()=>null);});
 await slowRequested;await cancelPage.evaluate(()=>globalThis.fixtureAbort.abort());await cancelPage.evaluate(()=>globalThis.fixtureRequest);
 const failed=await canceled.drain().then(()=>false,()=>true);check(failed&&canceled.summary().failures>0,'UNAVAILABLE_CANCELED_ENTITY_ACCEPTED');report.cancellation=canceled.summary();report.cases.push('canceled unavailable original entity fails closed');
 await cancelContext.close();await canceled.settleAfterClose();
 const disposalContext=await browser.newContext({serviceWorkers:'block'}),disposalPage=await disposalContext.newPage();
 const disposal=new OriginalResponses(origin,()=>{},tracking,r=>new URL(r.url).origin===origin);await disposal.attach(disposalContext,disposalPage);await disposalPage.goto(origin+'/');
 await disposalPage.evaluate(()=>{void fetch('/slow').catch(()=>null);});
 const disposalDeadline=Date.now()+3000;while((counts.get('GET /slow')??0)<2&&Date.now()<disposalDeadline)await new Promise(r=>setTimeout(r,20));
 check(counts.get('GET /slow')===2,'DISPOSAL_FIXTURE_NOT_REACHED');await disposalContext.close();await disposal.settleAfterClose();
 check(disposal.summary().pending===0&&disposal.summary().failures>0,'DISPOSAL_LOST_PENDING_CAPTURE');report.disposal=disposal.summary();report.cases.push('context disposal settles pending original-body reads as failures');

 for(const kind of ['cache','flags','body']){
  const before=tokens.size;const response=await fetchWithSessionTracking(origin+'/api/session?case='+kind,{method:'POST'},tracking);
  check(tokens.size===before+1,'LOGIN_HEADER_IDENTITY_NOT_REGISTERED_FIRST');
  let rejected=false;try{if(kind==='cache')check(response.headers.get('cache-control')==='no-store','SYNTHETIC_BAD_CACHE');else if(kind==='flags')check(/Secure/.test(response.headers.get('set-cookie')),'SYNTHETIC_BAD_FLAGS');else{await response.arrayBuffer();check(false,'SYNTHETIC_BODY_ASSERTION');}}catch{rejected=true;}check(rejected,'SYNTHETIC_POST_HEADER_FAILURE_NOT_EXERCISED');report.cases.push('cleanup identity survives '+kind+' assertion failure');
 }
 const browserHeaders=new SessionTracking(new Set(),new Set());const browserContext=await browser.newContext(),browserPage=await browserContext.newPage();
 const headerCapture=new OriginalResponses(origin,()=>{throw Error('SYNTHETIC_BODY_CHECK');},browserHeaders,r=>new URL(r.url).origin===origin);
 await headerCapture.attach(browserContext,browserPage);
 // Inject only a response lifecycle event to exercise the same synchronous
 // cookie-before-identity assertion used by actual Fetch response pauses.
 await headerCapture.paused({requestId:'synthetic-unmatched-login',networkId:'synthetic-unmatched-login',request:{method:'POST',url:origin+'/api/session'},responseStatusCode:500,responseHeaders:[{name:'Set-Cookie',value:'aegispay_session='+'D'.repeat(43)+'; Path=/'}]}).catch(()=>{});
 check(browserHeaders.summary().identified_sessions===1,'BROWSER_HEADER_IDENTITY_LOST_BEFORE_ASSERTION');report.cases.push('browser headers tracked before identity/body assertions');
 await browserContext.close();await headerCapture.settleAfterClose();
 for(const hash of tokens)if(syntheticSessions.has(hash))syntheticSessions.set(hash,true);
 check(priorState.every(([hash,value])=>syntheticSessions.get(hash)===value),'SYNTHETIC_PRIOR_SESSIONS_CHANGED');
 check([...syntheticSessions.values()].every(Boolean)&&tracking.summary().uncertain_commits===0,'SYNTHETIC_INVOCATION_CLEANUP_INCOMPLETE');
 const uncertain=new SessionTracking(new Set(),new Set());uncertain.begin();check(uncertain.summary().uncertain_commits===1,'UNCAPTURED_COMMIT_TREATED_AS_CLEAN');report.cases.push('uncaptured possible commit remains unresolved');
 report.session_cleanup={identified_synthetic_sessions:tokens.size,all_identified_revoked_in_synthetic_state:true,prior_16_revoked_sessions_untouched:true,uncertain_commit_refused:true,raw_tokens_exported:false};
 report.outcome='passed';
}catch(e){report.safe_failure=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'SYNTHETIC_REPAIR_CHECK_FAILED';}
finally{
 await browser?.close();await new Promise(r=>server.close(r));report.finished_at=new Date().toISOString();
 report.source_files=[];
 for(const name of ['repair-check.mjs','original-responses.mjs','session-tracking.mjs','browser.mjs','qualify.ts'])report.source_files.push({path:'deployment/finals/preview/'+name,lf_sha256:sha((await readFile('deployment/finals/preview/'+name,'utf8')).replaceAll('\r\n','\n'))});
 await exclusive(OUT+'/regression-'+attempt+'.json',report);process.stdout.write(JSON.stringify({outcome:report.outcome,safe_failure:report.safe_failure,cases:report.cases.length,receipt:OUT+'/regression-'+attempt+'.json'})+'\n');process.exitCode=report.outcome==='passed'?0:1;
}
