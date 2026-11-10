import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath:'C:/Users/Vincent/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',headless:true });
const base = process.env.UI_BASE_URL ?? 'http://127.0.0.1:3017';
const report = { base, observedAt:new Date().toISOString(), method:'Computed sRGB foreground against composited ancestor background; direct visible text nodes only. Native focus inspection, target rectangles and browser request observation. Not a formal accessibility conformance audit.', states:[] };
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const external = [];
  page.on('request', r => { if(!r.url().startsWith(base)) external.push(r.url()); });
  for (const [width,height] of [[1440,1000],[1280,720],[768,1024],[390,844],[320,740]]) {
  await page.setViewportSize({width,height});
  await page.goto(base,{waitUntil:'networkidle'});
  for (const state of ['Authorization','Over-cap refusal','Recovery rule','Receipt','Login']) {
    if(state==='Login') await page.goto(base+'/login',{waitUntil:'networkidle'});
    else if(state==='Receipt'){await page.getByRole('tab',{name:'Authorization',exact:true}).click();await page.evaluate(()=>{document.querySelector('#receipt').open=true;document.querySelector('.technical-details').open=true;});}
    else await page.getByRole('tab',{name:state,exact:true}).click();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {}))); });
    const audit=await page.evaluate(()=>{
      const rgba=s=>{const parts=s.match(/[\d.]+/g)?.map(Number)??[0,0,0];return [parts[0],parts[1],parts[2],parts[3]??1];};
      const blend=(a,b)=>[a[0]*a[3]+b[0]*(1-a[3]),a[1]*a[3]+b[1]*(1-a[3]),a[2]*a[3]+b[2]*(1-a[3]),1];
      const bg=el=>{const chain=[];for(let n=el;n;n=n.parentElement)chain.unshift(n);return chain.reduce((c,n)=>blend(rgba(getComputedStyle(n).backgroundColor),c),[255,255,255,1]);};
      const luminance=c=>c.slice(0,3).map(x=>{const v=x/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
      const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
      const rows=[];
      for(const el of document.querySelectorAll('body *')){
        if(['SCRIPT','STYLE','SVG','PATH','OPTION'].includes(el.tagName)||!el.getClientRects().length)continue;
        const rect=el.getBoundingClientRect();if(rect.width===0||rect.height===0)continue;
        const direct=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim();if(!direct)continue;
        const style=getComputedStyle(el),background=bg(el),foreground=blend(rgba(style.color),background),ratio=contrast(foreground,background),size=parseFloat(style.fontSize),weight=parseFloat(style.fontWeight),required=size>=24||(size>=18.66&&weight>=700)?3:4.5;
        rows.push({text:direct.slice(0,100),ratio:+ratio.toFixed(2),required,foreground:style.color,background:background.slice(0,3).map(Math.round),pass:ratio>=required});
      }
      const targets=[...document.querySelectorAll('a,button,summary,input,select')].filter(el=>el.getClientRects().length&&!el.classList.contains('skip-link')).map(el=>{const r=el.getBoundingClientRect();return {name:el.getAttribute('aria-label')||el.textContent.trim().slice(0,70),width:+r.width.toFixed(2),height:+r.height.toFixed(2)};});
      return {textCount:rows.length,minRatio:Math.min(...rows.map(r=>r.ratio)),contrastFailures:rows.filter(r=>!r.pass),smallTargets:targets.filter(r=>r.width<44||r.height<44),receiptOpen:document.querySelector('#receipt')?.open??null,scrollWidth:document.documentElement.scrollWidth};
    });
    report.states.push({state,width,height,...audit});
  }
  }
  await page.goto(base);
  await page.keyboard.press('Tab');
  report.focus=await page.evaluate(()=>({name:document.activeElement.textContent,outline:getComputedStyle(document.activeElement).outline,visible:document.activeElement.getBoundingClientRect().top>=0}));
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('tab',{name:'Over-cap refusal'}).focus();
  await page.screenshot({path:new URL('./captures/projector-keyboard-focus.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')});
  report.externalRuntimeRequests=external;
  report.passes=report.states.every(s=>!s.contrastFailures.length&&!s.smallTargets.length);
}finally{await browser.close();await writeFile(new URL('./accessibility-results.json',import.meta.url),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
