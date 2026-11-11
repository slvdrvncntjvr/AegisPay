/** Qualification-only fixed-target loopback HTTP observation proxy.
 * No application/config/DB imports. No redirects, retries, cookie jar or mocks.
 * Raw headers and payloads stay in memory; public diagnostics are fixed enums.
 */
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { gunzipSync, brotliDecompressSync, inflateSync } from 'node:zlib';
import type { BrowserContext, CDPSession, Page } from '@playwright/test';
export const FOLLOWUP='docs/evidence/finals-staging-app/proxy-2026-11-10T14-43Z';
export const CHROME='C:/Users/Vincent/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
export const sourcePaths=['deployment/finals/staging-app/proxy-capture.ts','deployment/finals/staging-app/capture-preflight.ts','deployment/finals/staging-app/qualify.ts'];
export function category(raw:string){const p=new URL(raw,'http://127.0.0.1').pathname;return p==='/api/session'?'SESSION':p==='/api/v1/state'?'STATE':p.startsWith('/_next/static/')?'STATIC':p==='/app'?'APP':p==='/login'?'LOGIN':p==='/'?'PUBLIC':p.startsWith('/fixture/')||p==='/favicon.ico'?'SYNTHETIC':'OTHER';}
const method=(s:string)=>['GET','HEAD','POST','DELETE','PUT','PATCH','OPTIONS'].includes(s)?s:'OTHER';
type Item={key:string;method:string;path_category:string;status:number|null;captured:boolean;matched:boolean;canceled:boolean;prefetch:boolean;bytes:number};
type BrowserItem={key:string;method:string;path_category:string;status:number|null;finished:boolean;delivered:boolean;canceled:boolean;prefetch:boolean};
type Diagnostic={method:string;status:number|null;path_category:string;category:string};
export class ObservationProxy {
  private server=http.createServer((req,res)=>{
    const group=this.active;
    const work=this.forward(req,res,group).catch(()=>{group?.fault('PROXY_HANDLER_FAILED');res.destroy();this.failures++;});
    this.pending.add(work);group?.pending.add(work);
    void work.finally(()=>{this.pending.delete(work);group?.pending.delete(work);group?.touch();});
  });
  private pending=new Set<Promise<void>>();
  private active:BrowserCapture|undefined;
  private records:Item[]=[];
  failures=0;
  private addressPort=0;
  constructor(private targetPort:number,private scan:(bytes:Buffer)=>void,private headersInMemory?:(method:string,p:string,status:number,headers:string[])=>void){
    if(!Number.isInteger(targetPort)||targetPort<1||targetPort>65535)throw new Error('INVALID_FIXED_LOOPBACK_TARGET');
    this.server.on('clientError',(_e,socket)=>socket.destroy());
    this.server.on('connect',(_req,socket)=>socket.destroy());
    this.server.on('upgrade',(_req,socket)=>socket.destroy());
  }
  async start(port:number){
    await new Promise<void>((resolve,reject)=>{this.server.once('error',()=>reject(new Error('PROXY_LISTEN_FAILED')));this.server.listen(port,'127.0.0.1',resolve);});
    this.addressPort=(this.server.address() as {port:number}).port;
    if(this.addressPort===this.targetPort)throw new Error('PROXY_TARGET_EQUALS_FRONT');
    return `http://127.0.0.1:${this.addressPort}`;
  }
  get origin(){return `http://127.0.0.1:${this.addressPort}`;}
  private async forward(req:IncomingMessage,res:ServerResponse,group:BrowserCapture|undefined){
    if(!req.url?.startsWith('/')||req.url.startsWith('//')||req.headers.host!==`127.0.0.1:${this.addressPort}`){this.failures++;group?.fault('INVALID_PROXY_REQUEST_TARGET');res.destroy();return;}
    const i:Item={key:req.method+' '+req.url,method:method(req.method??''),path_category:category(req.url),status:null,captured:false,matched:false,canceled:false,prefetch:!!(req.headers['next-router-prefetch']||req.headers['next-router-segment-prefetch']||/prefetch/i.test(String(req.headers.purpose??req.headers['sec-purpose']??''))),bytes:0};
    this.records.push(i);group?.upstream.push(i);group?.touch();
    res.once('close',()=>{if(!res.writableFinished){i.canceled=true;group?.emit(i,'CLIENT_CANCELED');group?.touch();}});
    const deadline=setTimeout(()=>{req.destroy();res.destroy();},25000);
    try{
      const chunks:Buffer[]=[];let size=0;
      for await(const b of req){size+=b.length;if(size>65536)throw new Error('REQUEST_LIMIT');chunks.push(Buffer.from(b));}
      const body=Buffer.concat(chunks);
      // Destination is constructor-owned, never taken from request headers/URL.
      const upstream=await new Promise<{status:number;phrase:string;headers:string[];body:Buffer}>((resolve,reject)=>{
        const q=http.request({host:'127.0.0.1',port:this.targetPort,path:req.url,method:req.method,headers:req.rawHeaders,agent:false,signal:AbortSignal.timeout(20000)},r=>{
          const parts:Buffer[]=[];let n=0;
          r.on('data',b=>{n+=b.length;if(n>16*1024*1024){r.destroy();reject(new Error('RESPONSE_LIMIT'));}else parts.push(Buffer.from(b));});
          r.once('aborted',()=>reject(new Error('UPSTREAM_ABORTED')));r.once('error',()=>reject(new Error('UPSTREAM_BODY_FAILED')));
          r.once('end',()=>resolve({status:r.statusCode!,phrase:r.statusMessage!,headers:r.rawHeaders,body:Buffer.concat(parts)}));
        });
        q.setTimeout(20000,()=>q.destroy());q.once('error',()=>reject(new Error('UPSTREAM_REQUEST_FAILED')));q.end(body);
      });
      i.status=upstream.status;i.bytes=upstream.body.length;
      this.headersInMemory?.(req.method!,req.url,upstream.status,upstream.headers);
      this.scan(upstream.body);
      let encoding='';for(let n=0;n<upstream.headers.length;n+=2)if(upstream.headers[n]!.toLowerCase()==='content-encoding')encoding=upstream.headers[n+1]!.toLowerCase();
      if(encoding&&encoding!=='identity'&&upstream.body.length){
        const options={maxOutputLength:16*1024*1024};
        const decoded=encoding==='gzip'?gunzipSync(upstream.body,options):encoding==='br'?brotliDecompressSync(upstream.body,options):encoding==='deflate'?inflateSync(upstream.body,options):undefined;
        if(!decoded)throw new Error('UNSUPPORTED_ENCODING');this.scan(decoded);
      }
      i.captured=true;group?.emit(i,'UPSTREAM_CAPTURED_BEFORE_DELIVERY');
      // Normal HTTP carries the original compressed entity and duplicate raw
      // headers; the browser, rather than CDP fulfillment, decodes the entity.
      if(!res.destroyed){res.writeHead(upstream.status,upstream.phrase,upstream.headers);res.end(upstream.body);}
      else group?.emit(i,'CANCELED_CAPTURE_RETAINED');
    }catch{this.failures++;group?.emit(i,'UPSTREAM_CAPTURE_FAILED');group?.fault('UPSTREAM_CAPTURE_FAILED');res.destroy();}
    finally{clearTimeout(deadline);group?.touch();}
  }
  async capture(context:BrowserContext,page:Page,synthetic=false){
    if(this.active)throw new Error('OVERLAPPING_CAPTURE_CONTEXT');
    const group=new BrowserCapture(this,context,this.origin,synthetic);this.active=group;await group.attach(page);return group;
  }
  release(group:BrowserCapture){if(this.active!==group)throw new Error('CAPTURE_CONTEXT_MISMATCH');this.active=undefined;}
  summary(){return{transport:'fixed-target normal Node HTTP reverse observation proxy',upstream_requests:this.records.length,upstream_captured:this.records.filter(i=>i.captured).length,upstream_entity_bytes:this.records.reduce((a,i)=>a+i.bytes,0),pending:this.pending.size,failures:this.failures,redirect_following:0,retries:0,cookie_jar:false,response_overrides:false,original_status_statusMessage_raw_duplicate_headers_entity:true,decoded_compressed_entities_also_scanned:true,request_body_limit:65536,response_body_limit:16777216,upstream_timeout_ms:20000,total_request_timeout_ms:25000,limits:'loopback only; fully buffers responses and alters streaming/timing/hop framing; browser cache disabled for capture contexts; no unintercepted/native-cache/hosted-egress qualification'};}
  async close(){await Promise.all([...this.pending]);await new Promise<void>(r=>{this.server.close(()=>r());this.server.closeIdleConnections();});}
}
export class BrowserCapture {
  readonly pending=new Set<Promise<void>>();readonly upstream:Item[]=[];
  private cdp!:CDPSession;private requests:BrowserItem[]=[];private byId=new Map<string,BrowserItem>();
  private diagnostics:Diagnostic[]=[];private failures=0;private lastActivity=Date.now();private version=0;
  private detached=false;
  constructor(private proxy:ObservationProxy,private context:BrowserContext,private origin:string,private synthetic:boolean){}
  touch(){this.version++;this.lastActivity=Date.now();}
  emit(i:Pick<Item,'method'|'status'|'path_category'>,c:string){this.diagnostics.push({method:i.method,status:i.status,path_category:i.path_category,category:c});}
  fault(c:string){this.failures++;this.emit({method:'OTHER',status:null,path_category:'OTHER'},c);}
  private delivered(i:BrowserItem,status:number){
    i.delivered=true;i.status=status;
    const own=this.upstream.find(u=>u.key===i.key&&u.captured&&!u.matched);
    if(!own)this.fault('DELIVERED_BODY_NOT_CAPTURED');else{own.matched=true;if(own.status!==status)this.fault('DELIVERED_STATUS_CHANGED');}
    this.emit(i,own?'DELIVERED_AFTER_CAPTURE':'MISSING_DELIVERED_CAPTURE');this.touch();
  }
  async attach(page:Page){
    this.cdp=await this.context.newCDPSession(page);
    this.cdp.on('Network.requestWillBeSent',(e:any)=>{
      if(e.redirectResponse){const previous=this.byId.get(e.requestId);if(previous){this.delivered(previous,e.redirectResponse.status);previous.finished=true;}}
      const u=new URL(e.request.url);if(u.origin!==this.origin){this.fault('OUTSIDE_BROWSER_ORIGIN');return;}
      const headers=e.request.headers;
      const i:BrowserItem={key:e.request.method+' '+u.pathname+u.search,method:method(e.request.method),path_category:category(u.pathname),status:null,finished:false,delivered:false,canceled:false,prefetch:Object.entries(headers).some(([k,v])=>/^(next-router-prefetch|next-router-segment-prefetch)$/i.test(k)||/^(purpose|sec-purpose)$/i.test(k)&&/prefetch/i.test(String(v)))};
      this.requests.push(i);this.byId.set(e.requestId,i);this.touch();
    });
    this.cdp.on('Network.responseReceived',(e:any)=>{const i=this.byId.get(e.requestId);if(i)this.delivered(i,e.response.status);else this.fault('RESPONSE_WITHOUT_REQUEST');});
    this.cdp.on('Network.loadingFinished',(e:any)=>{const i=this.byId.get(e.requestId);if(i)i.finished=true;this.touch();});
    this.cdp.on('Network.loadingFailed',(e:any)=>{const i=this.byId.get(e.requestId);if(!i)return;i.finished=true;i.canceled=e.canceled===true;if(!i.canceled||!this.synthetic&&!i.prefetch&&!i.delivered)this.fault('UNEXPECTED_BROWSER_REQUEST_FAILURE');this.emit(i,i.prefetch?'PREFETCH_CANCELED':'REQUEST_CANCELED');this.touch();});
    await this.cdp.send('Network.enable');await this.cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  }
  async drain(point:'BEFORE_NAVIGATION'|'BEFORE_LOGOUT'|'BEFORE_CLOSE'|'AFTER_TRANSITION'){
    const deadline=Date.now()+26000;
    while(Date.now()<deadline){
      // Chromium can omit loadingFailed for a fetch abandoned with its old
      // renderer. Require independent client socket closure AND a fully owned
      // upstream body; never infer cancellation merely from a missing event.
      for(const i of this.requests.filter(i=>!i.finished&&!i.delivered)){
        const own=this.upstream.find(u=>u.key===i.key&&u.canceled&&u.captured&&!u.matched);
        if(own&&(this.synthetic||i.prefetch||own.prefetch)){
          own.matched=true;i.finished=true;i.canceled=true;i.prefetch=i.prefetch||own.prefetch;
          this.emit(i,'CLIENT_SOCKET_CANCELED_UPSTREAM_CAPTURE_RETAINED');this.touch();
        }
      }
      if(this.failures&&!this.pending.size)throw new Error('BROWSER_CAPTURE_FAILED');
      const v=this.version;if(!this.pending.size&&this.requests.every(i=>i.finished)&&Date.now()-this.lastActivity>180){await new Promise(r=>setTimeout(r,30));if(v===this.version){this.emit({method:'OTHER',status:null,path_category:'OTHER'},'DRAIN_'+point);if(this.failures)throw new Error('BROWSER_CAPTURE_FAILED');return;}}await new Promise(r=>setTimeout(r,25));
    }
    this.fault('DRAIN_TIMEOUT_'+point);throw new Error('BROWSER_CAPTURE_DRAIN_TIMEOUT');
  }
  summary(){
    const b=new Map<string,number>(),u=new Map<string,number>();for(const i of this.requests)b.set(i.key,(b.get(i.key)??0)+1);for(const i of this.upstream)u.set(i.key,(u.get(i.key)??0)+1);
    const unmatchedBrowser=this.requests.filter(i=>i.canceled&&!i.delivered&&!this.upstream.some(q=>q.key===i.key)).length;
    const exact=[...b].every(([k,v])=>u.get(k)===v)&&[...u].every(([k,v])=>b.get(k)===v);
    return{browser_requests:this.requests.length,upstream_requests:this.upstream.length,exact_request_count_maps_match:exact,canceled_before_proxy:unmatchedBrowser,proxy_only_requests:[...u].filter(([k])=>!b.has(k)).length,delivered_responses:this.requests.filter(i=>i.delivered).length,missing_delivered_captures:this.diagnostics.filter(d=>d.category==='MISSING_DELIVERED_CAPTURE').length,canceled_requests:this.requests.filter(i=>i.canceled).length,canceled_prefetches:this.requests.filter(i=>i.canceled&&i.prefetch).length,upstream_captured:this.upstream.filter(i=>i.captured).length,pending_captures:this.pending.size,pending_browser_requests:this.requests.filter(i=>!i.finished).length,failures:this.failures,browser_cache_disabled:true,raw_urls_headers_bodies_errors_exported:false,diagnostics:this.diagnostics};
  }
  async detach(){if(this.detached)return;await this.drain('BEFORE_CLOSE');await this.cdp.detach();this.proxy.release(this);this.detached=true;}
}
