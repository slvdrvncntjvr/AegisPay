/** CDP reads the original paused response before unchanged continuation.
 * No Playwright body API, response fulfillment, stream replacement or refetch.
 */
import {check,sha} from './common.mjs';
const noEntity=(method,status)=>method==='HEAD'||[204,205,304].includes(status);
export function validateEntity(method,status,headers,body){
 const length=headers.find(h=>h.name.toLowerCase()==='content-length')?.value;
 if(noEntity(method,status)){check(body===null,'NON_ENTITY_BODY_NOT_APPLICABLE');return'HTTP_NON_ENTITY';}
 check(Buffer.isBuffer(body),'ORIGINAL_ENTITY_UNAVAILABLE');
 check(body.length<=16*1024*1024,'ORIGINAL_ENTITY_TOO_LARGE');
 if(!body.length)check(length==='0','EMPTY_ENTITY_WITHOUT_DECLARED_ZERO_LENGTH');
 if(length==='0')check(body.length===0,'ZERO_LENGTH_HEADER_BODY_MISMATCH');
 return body.length?'ORIGINAL_ENTITY':'DECLARED_ZERO_LENGTH_ENTITY';
}
export class OriginalResponses{
 constructor(origin,scan,tracking,allowed){
  this.origin=origin;this.scan=scan;this.tracking=tracking;this.allowed=allowed;
  this.records=new Map();this.network=new Map();this.browserRequests=new Map();this.pending=new Set();this.failures=[];this.commands=new Map();this.closed=false;
 }
 async send(name,args={}){this.commands.set(name,(this.commands.get(name)??0)+1);return this.cdp.send(name,args);}
 fail(code){this.failures.push(code);}
 async attach(context,page){
  this.context=context;this.cdp=await context.newCDPSession(page);
  this.onRequest=request=>{const key=request.method()+' '+request.url();this.browserRequests.set(key,(this.browserRequests.get(key)??0)+1);};
  context.on('request',this.onRequest);
  this.cdp.on('Fetch.requestPaused',event=>{
   const work=this.paused(event).catch(()=>{this.fail('ORIGINAL_RESPONSE_CAPTURE_FAILED');});
   this.pending.add(work);void work.finally(()=>this.pending.delete(work));
  });
  this.cdp.on('Network.loadingFailed',event=>{const r=this.network.get(event.requestId);if(r){r.canceled=event.canceled===true;r.networkFailed=true;if(!r.covered)this.fail('CANCELED_OR_FAILED_WITHOUT_ORIGINAL_ENTITY');}});
  await this.send('Network.enable');await this.send('Network.setCacheDisabled',{cacheDisabled:true});
  await this.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'},{urlPattern:'*',requestStage:'Response'}]});
 }
 async paused(e){
  const response=e.responseStatusCode!==undefined||e.responseErrorReason!==undefined;
  if(!response){
   const login=e.request.method==='POST'&&new URL(e.request.url).pathname==='/api/session';
   const r={id:e.requestId,networkId:e.networkId,key:e.request.method+' '+e.request.url,method:e.request.method,status:null,covered:false,canceled:false,paused:true,login:login?this.tracking.begin():null};
   this.records.set(e.requestId,r);if(e.networkId)this.network.set(e.networkId,r);
   if(e.redirectedRequestId){const previous=this.records.get(e.redirectedRequestId);if(previous)previous.redirectFollowed=true;else this.fail('REDIRECT_PARENT_IDENTITY_MISSING');}
   if(!e.networkId||!this.allowed(e.request)){
    this.fail(!e.networkId?'NETWORK_REQUEST_IDENTITY_MISSING':'FORBIDDEN_BROWSER_REQUEST');
    await this.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'Aborted'});r.paused=false;return;
   }
   await this.send('Fetch.continueRequest',{requestId:e.requestId});r.paused=false;return;
  }
  const r=this.records.get(e.requestId);
  // Cookie capture deliberately occurs before identity/status/body validation.
  const login=r?.login??(e.request.method==='POST'&&new URL(e.request.url).pathname==='/api/session'?this.tracking.begin():null);
  if(login)this.tracking.headers(login,e.responseStatusCode,(e.responseHeaders??[]).filter(h=>h.name.toLowerCase()==='set-cookie').map(h=>h.value));
  check(r&&r.networkId===e.networkId&&r.key===e.request.method+' '+e.request.url,'ORIGINAL_RESPONSE_IDENTITY_MISMATCH');
  r.paused=true;r.status=e.responseStatusCode;
  try{
   check(!e.responseErrorReason,'ORIGINAL_RESPONSE_ERROR');
   check(Number.isInteger(r.status)&&r.status>=100&&r.status<=599,'ORIGINAL_RESPONSE_STATUS_INVALID');
   const headers=e.responseHeaders??[];
   const redirect=[301,302,303,307,308].includes(r.status)&&headers.some(h=>h.name.toLowerCase()==='location');
   if(redirect){r.kind='REDIRECT_HEADERS_ONLY';r.redirect=true;r.covered=true;}
   else if(noEntity(r.method,r.status)){r.kind=validateEntity(r.method,r.status,headers,null);r.bytes=0;r.covered=true;}
   else{
    const entity=await this.send('Fetch.getResponseBody',{requestId:e.requestId});
    const body=Buffer.from(entity.body,entity.base64Encoded?'base64':'utf8');
    r.kind=validateEntity(r.method,r.status,headers,body);this.scan(body);
    r.bytes=body.length;r.sha256=sha(body);r.covered=true;
   }
   await this.send('Fetch.continueResponse',{requestId:e.requestId});r.continued=true;r.paused=false;
  }catch{
   this.fail('ORIGINAL_ENTITY_OR_CONTINUATION_UNAVAILABLE');
   // Never release an unscanned entity after capture failure.
   await this.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'Aborted'}).catch(()=>{});r.paused=false;
  }
 }
 summary(){
  const counts=new Map();for(const r of this.records.values())counts.set(r.key,(counts.get(r.key)??0)+1);
  const exact=[...counts].every(([k,n])=>this.browserRequests.get(k)===n)&&[...this.browserRequests].every(([k,n])=>counts.get(k)===n);
  const records=[...this.records.values()];
  return{
   requests:records.length,
   browser_requests:[...this.browserRequests.values()].reduce((a,n)=>a+n,0),
   exact_request_maps:exact,
   covered:records.filter(r=>r.covered&&r.continued).length,
   original_entities:records.filter(r=>r.kind==='ORIGINAL_ENTITY').length,
   declared_empty_entities:records.filter(r=>r.kind==='DECLARED_ZERO_LENGTH_ENTITY').length,
   non_entities:records.filter(r=>r.kind==='HTTP_NON_ENTITY').length,
   redirect_headers_only:records.filter(r=>r.redirect).length,
   canceled:records.filter(r=>r.canceled).length,
   missing_entities:records.filter(r=>!r.covered).length,
   unfollowed_redirects:records.filter(r=>r.redirect&&!r.redirectFollowed).length,
   pending:this.pending.size,
   failures:this.failures.length,
   safe_failures:[...new Set(this.failures)],
   response_evidence:records.map(r=>({
    request_identity_sha256:sha(r.key),
    fetch_id_sha256:sha(r.id),
    network_id_sha256:r.networkId?sha(r.networkId):null,
    method:r.method,status:r.status??null,kind:r.kind??'UNAVAILABLE',
    bytes:r.bytes??null,body_sha256:r.sha256??null,
    canceled:r.canceled,continued:r.continued===true,
    redirect_followed:r.redirectFollowed===true,
   })),
   commands:Object.fromEntries(this.commands),
   request_ids_retained_in_memory:true,
   raw_urls_headers_bodies_exported:false,
   cache_disabled:true,
   fetch_interception_changes_timing:true,
  };
 }
 async drain(){
  const end=Date.now()+20000;
  let previous=null;
  let stableSince=Date.now();
  while(Date.now()<end){
   const state=this.summary();
   const signature=JSON.stringify([state.requests,state.browser_requests,state.covered,state.pending,state.failures,state.unfollowed_redirects]);
   if(signature!==previous){previous=signature;stableSince=Date.now();}
   check(!state.failures||state.pending>0,'ORIGINAL_BROWSER_COVERAGE_INCOMPLETE');
   const complete=!state.pending&&!state.failures&&!state.missing_entities&&!state.unfollowed_redirects&&state.exact_request_maps&&state.covered===state.requests;
   // Browser request events can precede their paused Fetch events. Wait for
   // both maps to agree and remain stable before accepting the transition.
   if(complete&&Date.now()-stableSince>=180)return;
   await new Promise(resolve=>setTimeout(resolve,30));
  }
  throw Error('ORIGINAL_BROWSER_COVERAGE_INCOMPLETE');
 }
 trackSessionCookie(value){
  // Each qualification context starts without cookies and performs one login.
  // Match that context's completed login, never an unrelated global attempt.
  const logins=[...this.records.values()].filter(r=>r.login);
  check(logins.length===1,'AMBIGUOUS_BROWSER_LOGIN_FOR_COOKIE');
  const login=logins[0];
  check(login.status===204&&login.covered&&login.continued,'COMPLETED_BROWSER_LOGIN_REQUIRED');
  this.tracking.browserCookie(login.login,value);
 }
 async settleAfterClose(){
  // Caller closes its context first. This cancels in-flight protocol body
  // reads; never disable interception and leak an unscanned pending response.
  await Promise.allSettled([...this.pending]);
  this.context.off('request',this.onRequest);this.closed=true;
 }
}
