/** Owned synthetic loopback only: NO DB/config/application/provider imports. */
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { ObservationProxy, CHROME, type BrowserCapture } from './proxy-capture.ts';
import { FOLLOWUP, sourcePaths } from './continuation.ts';
const digest=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const check=(v:unknown,c:string)=>{if(!v)throw new Error(c);};
const sourceHashes=async()=>Promise.all(sourcePaths.map(async path=>({path,sha256:digest(await readFile(path))})));
const result:Record<string,any>={kind:'synthetic proxy/capture preflight only; not app/financial evidence',started_at:new Date().toISOString(),outcome:'failed',contexts:[],checks:[]};
const observed=new Set<string>();
const binary=Buffer.from([0,255,128,10,13,42]);const compressed=gzipSync('synthetic compressed response');
let frontOrigin='';let fixtureFaults=0;let serverRequests=0;let expectedHost='';
let heldSeen:()=>void=()=>{},releaseHeld:()=>void=()=>{};
const heldRequested=new Promise<void>(r=>{heldSeen=r;});const heldReleased=new Promise<void>(r=>{releaseHeld=r;});
const server=http.createServer((req,res)=>{void(async()=>{
  serverRequests++;if(req.headers.host!==expectedHost)fixtureFaults++;
  const p=new URL(req.url!,'http://127.0.0.1').pathname;const chunks:Buffer[]=[];for await(const b of req)chunks.push(Buffer.from(b));
  res.setHeader('Cache-Control','no-store');
  if(p==='/fixture/redirect'){res.writeHead(303,'Fixture Redirect',['Location','/fixture/cookie','Set-Cookie','redirect_cookie=synthetic; HttpOnly; SameSite=Strict; Path=/']);res.end('synthetic redirect entity');}
  else if(p==='/fixture/login'){
    if(req.method!=='POST'||Buffer.concat(chunks).toString()!=='synthetic request entity'||req.headers.origin!==frontOrigin||req.headers['x-fixture-fidelity']!=='synthetic')fixtureFaults++;
    res.writeHead(204,'Fixture Empty',['Set-Cookie','fixture_login=synthetic; HttpOnly; SameSite=Strict; Path=/','Set-Cookie','second_cookie=synthetic; HttpOnly; SameSite=Strict; Path=/; Expires=Tue, 01 Dec 2026 00:00:00 GMT']);res.end();
  }else if(p==='/fixture/logout'){if(req.method!=='DELETE')fixtureFaults++;res.writeHead(204,['Set-Cookie','fixture_login=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0']);res.end();}
  else if(p==='/fixture/cookie'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({login:req.headers.cookie?.includes('fixture_login=synthetic')??false,redirect:req.headers.cookie?.includes('redirect_cookie=synthetic')??false}));}
  else if(p==='/fixture/held'){heldSeen();await heldReleased;res.end('synthetic held entity after navigation');}
  else if(p==='/fixture/gzip'){res.writeHead(200,'Fixture Gzip',['Content-Encoding','gzip','Content-Type','text/plain','Content-Length',String(compressed.length)]);res.end(compressed);}
  else if(p==='/fixture/binary'){res.writeHead(200,'Fixture Binary',['Content-Type','application/octet-stream','Content-Length',String(binary.length)]);res.end(binary);}
  else{res.writeHead(200,['Content-Type','text/html; charset=utf-8','X-Synthetic-Preserved','fixed']);res.end('<!doctype html><title>Synthetic fixture</title><p>Owned loopback only</p>');}
})().catch(()=>{fixtureFaults++;res.destroy();});});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;let proxy:ObservationProxy|undefined;
await mkdir(FOLLOWUP,{recursive:true});
const executions=(await readdir(FOLLOWUP)).filter(p=>/^synthetic-execution-\d\.json$/.test(p));
check(executions.length<1,'SYNTHETIC_EXECUTION_LIMIT_REACHED');const attempt=executions.length+1;
await writeFile(FOLLOWUP+`/synthetic-execution-${attempt}.json`,JSON.stringify({attempt,started_at:result.started_at,source_files:await sourceHashes()},null,2)+'\n',{flag:'wx'});
try{
  check(process.argv.length===2,'NO_PREFLIGHT_ARGUMENTS_ALLOWED');result.source_files=await sourceHashes();
  const binding=JSON.parse(await readFile(FOLLOWUP+'/continuation-source-binding.json','utf8'));
  check(JSON.stringify(binding.source_files)===JSON.stringify(result.source_files),'CONTINUATION_SYNTHETIC_SOURCE_BINDING_MISMATCH');
  result.continuation_authorization_sha256=binding.authorization_sha256;
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  proxy=new ObservationProxy((server.address() as {port:number}).port,b=>{observed.add(digest(b));});frontOrigin=await proxy.start(0);expectedHost=new URL(frontOrigin).host;
  browser=await chromium.launch({executablePath:CHROME,headless:true});result.installed_browser_version=browser.version();
  for(let n=0;n<2;n++){
    const context=await browser.newContext({serviceWorkers:'block'});let capture:BrowserCapture|undefined;let completed=false;const checks:Record<string,unknown>={context:n};let initial:any;
    try{
      const page=await context.newPage();capture=await proxy.capture(context,page,true);
      check((await context.cookies()).length===0,'SYNTHETIC_CONTEXT_NOT_ISOLATED');checks.independent_empty_cookie_context=true;
      await capture.drain('BEFORE_NAVIGATION');initial=await page.goto(frontOrigin+'/fixture/start?context='+n);
      check(await initial.headerValue('x-synthetic-preserved')==='fixed','SYNTHETIC_RESPONSE_HEADER_CHANGED');await capture.drain('AFTER_TRANSITION');
      const login=await page.evaluate(async()=>{const r=await fetch('/fixture/login',{method:'POST',headers:{'X-Fixture-Fidelity':'synthetic'},body:'synthetic request entity'});return{status:r.status,text:await r.text()};});
      check(login.status===204&&login.text==='','SYNTHETIC_204_CHANGED');checks.empty_204_preserved=true;await capture.drain('AFTER_TRANSITION');
      const cookies=await context.cookies();check(['fixture_login','second_cookie'].every(name=>cookies.some(c=>c.name===name&&c.httpOnly&&c.sameSite==='Strict')),'SYNTHETIC_DUPLICATE_COOKIE_CHANGED');
      check(!(await page.evaluate(()=>document.cookie)).includes('fixture_login'),'SYNTHETIC_HTTPONLY_FAILED');checks.duplicate_http_only_cookies=true;
      await capture.drain('BEFORE_NAVIGATION');await page.goto(frontOrigin+'/fixture/redirect');
      check((await page.locator('body').innerText()).includes('"login":true,"redirect":true'),'SYNTHETIC_COOKIE_REQUEST_FIDELITY_FAILED');await capture.drain('AFTER_TRANSITION');
      check(observed.has(digest('synthetic redirect entity')),'SYNTHETIC_REDIRECT_BODY_MISSING');checks.redirect_body_and_cookie_preserved=true;
      const gzip=await page.evaluate(async()=>{const r=await fetch('/fixture/gzip');return{text:await r.text(),encoding:r.headers.get('content-encoding'),length:r.headers.get('content-length'),phrase:r.statusText};});
      checks.gzip_decoded_matches=gzip.text==='synthetic compressed response';checks.gzip_headers_match=gzip.encoding==='gzip'&&gzip.length===String(compressed.length)&&gzip.phrase==='Fixture Gzip';
      checks.gzip_upstream_raw_scanned=observed.has(digest(compressed));checks.gzip_decoded_scanned=observed.has(digest('synthetic compressed response'));checks.gzip_synthetic_decoded_sha256=digest(gzip.text);checks.gzip_synthetic_upstream_sha256=digest(compressed);
      check(checks.gzip_decoded_matches,'SYNTHETIC_GZIP_DECODED_CHANGED');check(checks.gzip_headers_match,'SYNTHETIC_GZIP_HEADERS_CHANGED');check(checks.gzip_upstream_raw_scanned&&checks.gzip_decoded_scanned,'SYNTHETIC_GZIP_SCAN_MISSING');
      const bin=await page.evaluate(async()=>{const r=await fetch('/fixture/binary');return{bytes:[...new Uint8Array(await r.arrayBuffer())],length:r.headers.get('content-length'),phrase:r.statusText};});
      checks.binary_matches=Buffer.from(bin.bytes).equals(binary);checks.binary_headers_match=bin.length===String(binary.length)&&bin.phrase==='Fixture Binary';checks.binary_upstream_scanned=observed.has(digest(binary));checks.binary_synthetic_sha256=digest(Buffer.from(bin.bytes));
      check(checks.binary_matches,'SYNTHETIC_BINARY_CHANGED');check(checks.binary_headers_match,'SYNTHETIC_BINARY_HEADERS_CHANGED');check(checks.binary_upstream_scanned,'SYNTHETIC_BINARY_SCAN_MISSING');await capture.drain('AFTER_TRANSITION');
      if(n===0){
        // Controlled stress exception to normal drain-before-transition.
        await page.evaluate(()=>{void fetch('/fixture/held',{headers:{Purpose:'prefetch'}}).catch(()=>{});});
        let waitTimer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([heldRequested,new Promise((_,reject)=>{waitTimer=setTimeout(()=>reject(new Error('SYNTHETIC_HELD_REQUEST_TIMEOUT')),10000);})]);}finally{clearTimeout(waitTimer);}
        await page.goto(frontOrigin+'/fixture/fast-navigation');releaseHeld();await capture.drain('AFTER_TRANSITION');
        checks.canceled_body_owned=observed.has(digest('synthetic held entity after navigation'));checks.browser_cancellation_observed=capture.summary().canceled_requests>0;
        check(checks.canceled_body_owned,'SYNTHETIC_CANCELED_UPSTREAM_BODY_MISSING');check(checks.browser_cancellation_observed,'SYNTHETIC_CANCELLATION_NOT_EXERCISED');
      }
      await capture.drain('BEFORE_LOGOUT');check(await page.evaluate(async()=>(await fetch('/fixture/logout',{method:'DELETE'})).status)===204,'SYNTHETIC_LOGOUT_CHANGED');await capture.drain('AFTER_TRANSITION');
      check(!(await context.cookies()).some(c=>c.name==='fixture_login'),'SYNTHETIC_LOGOUT_COOKIE_RETAINED');checks.logout_cookie_cleared=true;
      await capture.drain('BEFORE_CLOSE');const summary=capture.summary();check(summary.exact_request_count_maps_match,'SYNTHETIC_REQUEST_COUNT_MAP_MISMATCH');check(summary.missing_delivered_captures===0&&summary.failures===0,'SYNTHETIC_DELIVERED_BODY_MISSING');
      checks.upstream_ownership_verified_before_disposal=true;completed=true;
    }catch(e){checks.safe_failure=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'SYNTHETIC_CONTEXT_ASSERTION_FAILED';throw e;}
    finally{
      releaseHeld();if(capture){try{await capture.detach();}catch{checks.capture_detach_failed=true;completed=false;}finally{result.contexts.push({context:n,completed,...capture.summary()});}}else result.contexts.push({context:n,completed:false,safe_failure:'CAPTURE_ATTACH_NOT_COMPLETED'});
      await context.close().catch(()=>{checks.context_close_failed=true;completed=false;});if(initial)checks.post_disposal_browser_body_available=await initial.body().then(()=>true,()=>false);result.checks.push(checks);
    }
    check(completed,'SYNTHETIC_CONTEXT_INCOMPLETE');
  }
  check(fixtureFaults===0,'SYNTHETIC_REQUEST_FIDELITY_FAILED');const summary=proxy.summary();
  check(summary.upstream_requests===serverRequests&&summary.upstream_requests===summary.upstream_captured&&summary.failures===0&&summary.pending===0,'SYNTHETIC_UPSTREAM_COUNT_OR_CAPTURE_FAILED');
  check(JSON.stringify(await sourceHashes())===JSON.stringify(result.source_files),'SYNTHETIC_HELPER_SOURCE_CHANGED');
  result.exactly_once={browser_requests:result.contexts.reduce((n:number,c:any)=>n+c.browser_requests,0),proxy_requests:summary.upstream_requests,fixture_upstream_requests:serverRequests,exact_maps_each_context:true,includes_canceled_and_favicon_requests:true};result.outcome='passed';
}catch(e){result.safe_failure=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'SYNTHETIC_PREFLIGHT_ASSERTION_FAILED';}
finally{
  releaseHeld();await browser?.close().catch(()=>{result.outcome='failed';result.safe_cleanup_failure='BROWSER_CLOSE_FAILED';});await proxy?.close().catch(()=>{result.outcome='failed';result.safe_cleanup_failure='PROXY_CLOSE_FAILED';});
  result.proxy=proxy?.summary();await new Promise<void>(r=>server.close(()=>r()));result.fixture_request_fidelity_failures=fixtureFaults;result.attempt=attempt;result.finished_at=new Date().toISOString();
  await writeFile(FOLLOWUP+`/preflight-${attempt}.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({outcome:result.outcome,safe_failure:result.safe_failure,attempt,contexts:result.contexts.length,report:FOLLOWUP+`/preflight-${attempt}.json`})+'\n');process.exitCode=result.outcome==='passed'?0:1;
}
