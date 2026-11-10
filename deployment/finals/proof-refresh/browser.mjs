import { chromium, expect } from '@playwright/test';
import { PUBLIC_PROOF as proof } from '../../../apps/web/src/lib/public-proof.ts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root=process.cwd();
const base=process.env.PROOF_BASE_URL || 'http://127.0.0.1:3026';
const label=process.env.PROOF_LABEL || 'local';
const out=path.join(root,'docs/evidence/finals-proof-deployment',label);
await fs.mkdir(out,{recursive:true});
const headers={};
if(process.env.PROOF_AUTHENTICATED==='1'){
  const dir=path.join(process.env.APPDATA,'com.vercel.cli/Data');
  const auth=JSON.parse(await fs.readFile(path.join(dir,'auth.json'),'utf8'));
  const config=JSON.parse(await fs.readFile(path.join(dir,'config.json'),'utf8'));
  const res=await fetch('https://api.vercel.com/v9/projects/prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq?teamId='+config.currentTeam,{headers:{Authorization:'Bearer '+auth.token}});
  let p=await res.json();
  let entries=Object.entries(p.protectionBypass||{}).filter(([,v])=>v.scope==='automation-bypass');
  if(!entries.length){
    // Same provider endpoint/body used by the pinned CLI's supported automatic bypass.
    const created=await fetch('https://api.vercel.com/v1/projects/prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq/protection-bypass?teamId='+config.currentTeam,{method:'PATCH',headers:{Authorization:'Bearer '+auth.token,'Content-Type':'application/json'},body:'{}'});
    if(!created.ok)throw new Error('Provider automation bypass creation HTTP '+created.status);
    p=await created.json();entries=Object.entries(p.protectionBypass||{}).filter(([,v])=>v.scope==='automation-bypass');
  }
  if(!entries.length)throw new Error('Provider returned no automation bypass');
  headers['x-vercel-protection-bypass']=entries[0][0];
}
const report={base,label,observedAt:new Date().toISOString(),views:[],routes:[],assets:[],externalRuntimeRequests:[],pageErrors:[],failedRequests:[],cancelledFavicons:[],nonReadRequests:[],links:[],responseFiles:0};
const browser=await chromium.launch({executablePath:'C:/Users/Vincent/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',headless:true});
report.browser=browser.version();
const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
if(Object.keys(headers).length)await context.route('**/*',route=>route.continue({headers:{...route.request().headers(),...(new URL(route.request().url()).origin===new URL(base).origin?headers:{})}}));
const page=await context.newPage();
const pending=[];
let responseNumber=0;
page.on('pageerror',e=>report.pageErrors.push(e.message));
page.on('requestfailed',r=>{const row={url:r.url(),error:r.failure()?.errorText};if(new URL(r.url()).pathname==='/icon.svg'&&row.error==='net::ERR_ABORTED')report.cancelledFavicons.push(row);else report.failedRequests.push(row);});
page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))report.nonReadRequests.push({method:r.method(),url:r.url()});if(new URL(r.url()).origin!==new URL(base).origin)report.externalRuntimeRequests.push(r.url());});
page.on('response',r=>{if(new URL(r.url()).origin===new URL(base).origin){const index=++responseNumber;pending.push((async()=>{try{const b=await r.body();await fs.writeFile(path.join(out,`response-${index}.bin`),b);report.responseFiles++;}catch{}})());}});
async function settle(){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));});}
try{
  const r=await page.goto(base,{waitUntil:'networkidle'});expect(r.status()).toBe(200);
  await expect(page.getByRole('heading',{level:1})).toHaveText('Useful data.Bounded spending.');
  await expect(page.locator('.policy-expiry')).toContainText('Historical policy expired');
  await expect(page.locator('.instrument-bottom')).toContainText('Not a completed autonomous model purchase');
  const targets=[proof.githubRepo,proof.pitchPdf,'https://drive.google.com/drive/folders/1hqwzOaG_qU9axjcLIjBUb1YeMWdOFq72?usp=sharing',...Object.values(proof.txs).map(t=>t.url),proof.githubRepo+'/blob/main/'+proof.evidencePath,'https://aegispay-live.vercel.app/'];
  for(const href of targets){expect(await page.locator('a').evaluateAll((a,h)=>a.some(el=>el.getAttribute('href')===h),href)).toBe(true);report.links.push({href,exact:true});}
  await page.getByRole('tab',{name:'Over-cap refusal',exact:true}).click();
  await expect(page.locator('.amount')).toContainText('0.12');
  await expect(page.locator('.decision-title')).toHaveText('No payment submitted.');
  await page.getByRole('button',{name:'Inspect Velo boundary',exact:true}).click();
  await page.reload();await expect(page.getByRole('button',{name:'Inspect Velo boundary'})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('tab',{name:'Over-cap refusal'})).toHaveAttribute('aria-selected','true');
  await settle();await page.screenshot({path:path.join(out,'desktop-refusal.png')});
  await page.getByRole('tab',{name:'Authorization',exact:true}).focus();await page.keyboard.press('End');
  await expect(page.getByRole('tab',{name:'Recovery rule'})).toBeFocused();
  await expect(page.locator('.trace-caption')).toContainText('not executed');
  await page.getByRole('button',{name:'Read recovery rule'}).click();await expect(page.locator('#recovery-detail')).toContainText('no live status observation');
  await page.reload();await expect(page.getByRole('tab',{name:'Recovery rule'})).toHaveAttribute('aria-selected','true');
  await settle();await page.screenshot({path:path.join(out,'desktop-recovery.png')});
  await page.getByRole('tab',{name:'Authorization',exact:true}).focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'Over-cap refusal'})).toBeFocused();await page.keyboard.press('Home');await expect(page.getByRole('tab',{name:'Authorization',exact:true})).toBeFocused();
  await page.getByRole('link',{name:'Inspect full receipt',exact:true}).click();await expect(page.locator('#receipt')).toHaveAttribute('open','');
  for(const [name,t] of [['Inner Noir authorization',proof.txs.inner],['Outer fee-bump and event transaction',proof.txs.outer],['Separate merchant claim',proof.txs.claim]]){
    await expect(page.getByRole('link',{name:'Open '+name+' in explorer'})).toHaveAttribute('href',t.url);
    await page.getByRole('button',{name:'Copy '+name,exact:true}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(t.hash);
  }
  await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{value:()=>Promise.reject(new Error('Denied'))}));await page.getByRole('button',{name:'Copy Separate merchant claim',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Copy unavailable'})).toBeVisible();
  await page.locator('.technical-details > summary').click();await page.screenshot({path:path.join(out,'desktop-receipt.png'),fullPage:true});
  for(const [name,width,height] of [['desktop',1440,1000],['projector',1280,720],['tablet',768,1024],['mobile390',390,844],['mobile320',320,740]]){
    await page.setViewportSize({width,height});await page.goto(base,{waitUntil:'networkidle'});await settle();
    await page.screenshot({path:path.join(out,name+'-viewport.png')});await page.screenshot({path:path.join(out,name+'-full.png'),fullPage:true});
    for(const state of ['Authorization','Over-cap refusal','Recovery rule']){
      await page.getByRole('tab',{name:state,exact:true}).click();await settle();
      const metrics=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,fontLoaded:document.fonts.check('600 48px Bricolage'),instrumentBottom:document.querySelector('.instrument').getBoundingClientRect().bottom}));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(width);expect(metrics.fontLoaded).toBe(true);
      report.views.push({name,width,height,state,...metrics});
    }
    if(name==='projector'){await page.getByRole('tab',{name:'Authorization',exact:true}).click();await page.getByRole('link',{name:'Focus the evidence',exact:true}).click();await page.waitForTimeout(700);await page.screenshot({path:path.join(out,'projector-focused.png')});}
    if(width===320){await page.getByRole('tab',{name:'Authorization',exact:true}).click();await page.getByRole('link',{name:'Inspect full receipt',exact:true}).click();await page.locator('.technical-details > summary').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);await page.locator('.identity').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'mobile320-identities.png')});}
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('tab',{name:'Over-cap refusal'}).click();expect(await page.locator('.flow-active').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  for(const route of ['/api/health','/app','/login','/api/session','/api/v1/state','/api/v1/catalog','/api/v1/runs','/api/v1/receipts/example','/api/demo/quick-signal/demo-parser']){
    const r=await context.request.get(base+route,{headers});report.routes.push({route,status:r.status(),cacheControl:r.headers()['cache-control']});expect(r.status()).toBe(route==='/api/health'?200:404);const b=await r.body();await fs.writeFile(path.join(out,'route-'+route.replaceAll('/','_')+'.bin'),b);
    if(route==='/api/health')expect(JSON.parse(b)).toEqual({status:'ok',network:'testnet'});
  }
  for(const asset of ['/icon.svg','/fonts/bricolage-grotesque.woff2']){
    const r=await context.request.get(base+asset,{headers});expect(r.status()).toBe(200);const bytes=await r.body();const source=await fs.readFile(path.join(root,'apps/web/public',asset));
    const sha=createHash('sha256').update(bytes).digest('hex');expect(sha).toBe(createHash('sha256').update(source).digest('hex'));report.assets.push({path:asset,status:r.status(),sha256:sha,sourceBytesMatch:true});
  }
  expect(report.pageErrors).toEqual([]);expect(report.externalRuntimeRequests).toEqual([]);expect(report.nonReadRequests).toEqual([]);expect(report.failedRequests).toEqual([]);
  report.passed=true;
}catch(e){report.passed=false;report.failure=String(e);process.exitCode=1;}finally{await Promise.allSettled(pending);await context.close();await browser.close();await fs.writeFile(path.join(out,'browser-results.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({label,passed:report.passed,views:report.views.length,pageErrors:report.pageErrors.length,externalRuntimeRequests:report.externalRuntimeRequests.length,responseFiles:report.responseFiles,failure:report.failure}));
