import { chromium } from '@playwright/test';
import { readFile,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const browser=await chromium.launch({executablePath:process.env.LOCALAPPDATA+'/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});const requests=[];await page.route('**/*',r=>{requests.push(r.request().url());return r.request().url().startsWith('file:')?r.continue():r.abort()});
 await page.goto(pathToFileURL(resolve('docs/submission/deck.html')).href);await page.evaluate(()=>document.fonts.ready);
 const seconds=await page.locator('.notes').evaluateAll(ns=>ns.map(n=>Number(n.dataset.seconds)));if(seconds.reduce((a,b)=>a+b,0)!==300)throw Error('Timing');
 const words=await page.locator('.notes p').evaluateAll(ns=>ns.map(n=>n.textContent.split(/\s+/).length));
 const font=await page.evaluate(()=>document.fonts.check('650 64px Bricolage'));if(!font)throw Error('Font not loaded');
 await page.getByRole('button',{name:'Speaker notes (N)',exact:true}).click();if(!await page.locator('.notes').first().isVisible())throw Error('Note button');await page.keyboard.press('n');if(await page.locator('.notes').first().isVisible())throw Error('N shortcut');
 await page.getByRole('button',{name:'Q&A prompts',exact:true}).click();if(!await page.locator('#qa').isVisible())throw Error('QA open');await page.getByRole('button',{name:'Close',exact:true}).click();if(await page.locator('#qa').isVisible())throw Error('QA close');
 await page.keyboard.press('n');await page.getByRole('button',{name:'Q&A prompts',exact:true}).click();await page.emulateMedia({media:'print'});for(const s of ['.notes','.toolbar','#qa'])if(await page.locator(s).first().isVisible())throw Error('Printed '+s);
 const result={browser:browser.version(),notesSeconds:seconds,totalSeconds:300,wordsBySlide:words,totalWords:words.reduce((a,b)=>a+b,0),fontLoaded:font,notesButton:true,nShortcut:true,qaOpenClose:true,printControlsHidden:true,externalSubresources:requests.filter(u=>!u.startsWith('file:'))};
 await writeFile('docs/evidence/finals-pitch-refresh/final/presenter-gates.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close()}
const gates=JSON.parse(await readFile('docs/evidence/finals-pitch-refresh/final/pdf-gates.json','utf8'));const results=[];
for(let i=0;i<gates.allTargets.length;i+=4){results.push(...await Promise.all(gates.allTargets.slice(i,i+4).map(async url=>{const startedAt=new Date().toISOString();try{let r=await fetch(url,{signal:AbortSignal.timeout(15000)});await r.arrayBuffer();return {url,startedAt,status:r.status,finalUrl:r.url}}catch(e){return{url,startedAt,error:e.message}}})));}
await writeFile('docs/evidence/finals-pitch-refresh/final/link-readback.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(r=>({url:r.url,status:r.status,error:r.error}))));
