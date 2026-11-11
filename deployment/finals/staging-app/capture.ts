/** Qualification-only HTTP transport. Never import into application code.
 * CDP pauses each browser request (including redirect hops); one native Node
 * HTTP request owns the actual upstream entity bytes before browser delivery.
 * No redirect following, retries, cookie jar, response overrides or raw logging.
 */
import http from 'node:http';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';
import type { BrowserContext, CDPSession, Page } from '@playwright/test';

export const CHROME = 'C:/Users/Vincent/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
export const FOLLOWUP = 'docs/evidence/finals-staging-app/capture-2026-11-10T14-33Z';
export function category(raw: string) {
  const p = new URL(raw).pathname;
  if (p === '/api/session') return 'SESSION';
  if (p === '/api/v1/state') return 'STATE';
  if (p.startsWith('/_next/static/')) return 'STATIC';
  if (p === '/app') return 'APP';
  if (p === '/login') return 'LOGIN';
  if (p === '/') return 'PUBLIC';
  if (p.startsWith('/fixture/')) return 'SYNTHETIC';
  return 'OTHER';
}
const allowedMethods = new Set(['GET','HEAD','POST','DELETE','PUT','PATCH','OPTIONS']);
type Diagnostic = { method: string; status: number | null; path_category: string; category: string };
type Item = { method: string; path_category: string; status: number | null; scanned: boolean; delivered: boolean; canceled: boolean; prefetch: boolean; finished: boolean };
export class Capture {
  readonly diagnostics: Diagnostic[] = [];
  readonly semantics = {
    transport: 'CDP Fetch request interception + one native Node HTTP request per paused request',
    redirects_followed_by_transport: 0, retries: 0, raw_response_headers_exported: false,
    upstream_entity_bytes_scanned_before_delivery: true, decoded_compressed_entities_also_scanned: true,
    status_headers_entity_body_passed_unchanged: true, native_browser_cache_qualified: false,
    limits: 'HTTP loopback only; interception buffers full entities and changes streaming/timing/cache behavior; no hosted egress, native cache or unintercepted browser qualification',
  };
  private cdp!: CDPSession;
  private pending = new Set<Promise<void>>();
  private network = new Map<string, Item>();
  private intercepted = new Set<string>();
  private faults = 0;
  private scanned = 0;
  private bytes = 0;
  private delivered = 0;
  private canceled = 0;
  private generation = 0;
  private lastActivity = Date.now();
  constructor(private context: BrowserContext, private origin: string, private scan: (bytes: Buffer) => void, private syntheticCancellation = false) {}
  private emit(i: Item, c: string) { this.diagnostics.push({ method: i.method, status: i.status, path_category: i.path_category, category: c }); }
  private touch() { this.generation++; this.lastActivity = Date.now(); }
  private fault(i: Item, c: string) { this.faults++; this.emit(i,c); }
  async attach(page: Page) {
    this.cdp = await this.context.newCDPSession(page);
    this.cdp.on('Network.requestWillBeSent', (e: any) => {
      const prior = this.network.get(e.requestId);
      // A redirect reuses its Network ID; every hop has a distinct Fetch ID.
      if (e.redirectResponse && prior && !prior.scanned) this.fault(prior,'REDIRECT_BODY_NOT_CAPTURED');
      this.network.set(e.requestId, {method: allowedMethods.has(e.request.method) ? e.request.method : 'OTHER', path_category: category(e.request.url), status:null,scanned:false,delivered:false,canceled:false,prefetch:false,finished:false});
      this.touch();
    });
    this.cdp.on('Network.responseReceived', (e: any) => {
      const i = this.network.get(e.requestId);
      if (!i) { this.fault({method:'OTHER',path_category:'OTHER',status:e.response.status} as Item,'DELIVERED_WITHOUT_REQUEST'); return; }
      i.delivered=true; i.status=e.response.status; this.delivered++;
      if (!i.scanned) this.fault(i,'DELIVERED_BODY_NOT_CAPTURED');
      this.emit(i,'DELIVERED_AFTER_CAPTURE'); this.touch();
    });
    this.cdp.on('Network.loadingFinished', (e: any) => { const i=this.network.get(e.requestId); if(i)i.finished=true; this.touch(); });
    this.cdp.on('Network.loadingFailed', (e: any) => {
      const i=this.network.get(e.requestId); if(!i)return;
      i.finished=true; i.canceled=e.canceled===true;
      if(i.canceled && !i.delivered && (i.prefetch || this.syntheticCancellation)) { this.canceled++; this.emit(i,'CANCELED_WITHOUT_DELIVERED_RESPONSE'); }
      else this.fault(i,'UNEXPECTED_BROWSER_REQUEST_FAILURE');
      this.touch();
    });
    this.cdp.on('Fetch.requestPaused', (e: any) => {
      const work=this.forward(e).catch(()=>{ this.faults++; this.diagnostics.push({method:'OTHER',status:null,path_category:'OTHER',category:'CAPTURE_HANDLER_FAILED'}); });
      this.pending.add(work); this.touch();
      void work.finally(()=>{this.pending.delete(work);this.touch();});
    });
    await this.cdp.send('Network.enable');
    // Both domains are enabled before the first navigation/request.
    await this.cdp.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  }
  private async forward(e: any) {
    const i=this.network.get(e.networkId);
    if(!i || this.intercepted.has(e.requestId)) throw new Error('INTERCEPTION_IDENTITY_FAILED');
    this.intercepted.add(e.requestId);
    const u=new URL(e.request.url);
    if(u.origin!==this.origin || u.protocol!=='http:') { this.fault(i,'OUTSIDE_OWNED_ORIGIN'); await this.cdp.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'BlockedByClient'}); return; }
    const headers = e.request.headers as Record<string,string>;
    i.prefetch=Object.entries(headers).some(([k,v])=>/^(next-router-prefetch|next-router-segment-prefetch)$/i.test(k) || /^(purpose|sec-purpose)$/i.test(k)&&/prefetch/i.test(v));
    let body: Buffer | undefined;
    if(e.request.hasPostData) {
      if(e.request.postDataEntries?.length && e.request.postDataEntries.every((v:any)=>typeof v.bytes==='string')) body=Buffer.concat(e.request.postDataEntries.map((v:any)=>Buffer.from(v.bytes,'base64')));
      else if(typeof e.request.postData==='string') body=Buffer.from(e.request.postData);
      else { this.fault(i,'ORIGINAL_REQUEST_BODY_UNAVAILABLE'); await this.cdp.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'Failed'}); return; }
    }
    try {
      // agent:false owns a new connection; Node http does not retry or follow
      // redirects and does not decode content encodings or maintain cookies.
      const upstream=await new Promise<{status:number;phrase:string;headers:{name:string;value:string}[];body:Buffer}>((resolve,reject)=>{
        const req=http.request(u,{method:e.request.method,headers,agent:false},res=>{
          const chunks:Buffer[]=[];
          res.on('data',b=>chunks.push(Buffer.from(b)));
          res.once('error',()=>reject(new Error('UPSTREAM_BODY_FAILED')));
          res.once('aborted',()=>reject(new Error('UPSTREAM_BODY_FAILED')));
          res.once('end',()=>resolve({status:res.statusCode!,phrase:res.statusMessage!,headers:Array.from({length:res.rawHeaders.length/2},(_,n)=>({name:res.rawHeaders[n*2]!,value:res.rawHeaders[n*2+1]!})),body:Buffer.concat(chunks)}));
        });
        req.setTimeout(20000,()=>req.destroy(new Error('UPSTREAM_TIMEOUT')));
        req.once('error',()=>reject(new Error('UPSTREAM_REQUEST_FAILED')));
        req.end(body);
      });
      i.status=upstream.status;
      this.scan(upstream.body);
      const encoding=upstream.headers.find(h=>h.name.toLowerCase()==='content-encoding')?.value.toLowerCase();
      if(encoding && upstream.body.length) {
        const decoded=encoding==='gzip'?gunzipSync(upstream.body):encoding==='br'?brotliDecompressSync(upstream.body):encoding==='deflate'?inflateSync(upstream.body):encoding==='identity'?upstream.body:undefined;
        if(!decoded)throw new Error('UNSUPPORTED_CONTENT_ENCODING');
        if(decoded!==upstream.body)this.scan(decoded);
      }
      this.scanned++;this.bytes+=upstream.body.length;i.scanned=true;
      this.emit(i,'UPSTREAM_CAPTURED_BEFORE_DELIVERY');
      try {
        await this.cdp.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:upstream.status,responsePhrase:upstream.phrase,responseHeaders:upstream.headers,body:upstream.body.toString('base64')});
      } catch {
        // Cancellation must be corroborated by Network.loadingFailed, never
        // inferred from an exception message or a disposed page/context.
        await new Promise(r=>setTimeout(r,50));
        if(i.canceled && !i.delivered && (i.prefetch || this.syntheticCancellation))this.emit(i,'CANCELED_CAPTURE_RETAINED');
        else this.fault(i,'DELIVERY_FAILED');
      }
    } catch {
      this.fault(i,'UPSTREAM_CAPTURE_OR_SCAN_FAILED');
      await this.cdp.send('Fetch.failRequest',{requestId:e.requestId,errorReason:'Failed'}).catch(()=>{});
    }
  }
  async drain(point: 'BEFORE_NAVIGATION'|'BEFORE_LOGOUT'|'BEFORE_CLOSE'|'AFTER_TRANSITION') {
    const deadline=Date.now()+25000;
    while(Date.now()<deadline) {
      const version=this.generation;
      if(!this.pending.size && [...this.network.values()].every(i=>i.finished) && Date.now()-this.lastActivity>=150) {
        await new Promise(r=>setTimeout(r,30));
        if(version===this.generation) {
          this.diagnostics.push({method:'OTHER',status:null,path_category:'OTHER',category:'DRAIN_'+point});
          if(this.faults)throw new Error('BROWSER_CAPTURE_FAILED');
          return;
        }
      }
      await new Promise(r=>setTimeout(r,25));
    }
    this.diagnostics.push({method:'OTHER',status:null,path_category:'OTHER',category:'DRAIN_TIMEOUT_'+point});
    throw new Error('BROWSER_CAPTURE_DRAIN_TIMEOUT');
  }
  summary() { return { ...this.semantics, upstream_bodies:this.scanned,upstream_bytes:this.bytes,delivered_responses:this.delivered,expected_canceled_without_response:this.canceled,failures:this.faults,pending_captures:this.pending.size,pending_network:[...this.network.values()].filter(i=>!i.finished).length,diagnostics:this.diagnostics }; }
  async detach() { await this.drain('BEFORE_CLOSE'); await this.cdp.send('Fetch.disable'); await this.cdp.detach(); }
}
