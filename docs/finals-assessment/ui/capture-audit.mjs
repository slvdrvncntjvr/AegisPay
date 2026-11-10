import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const out = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch({headless:true, executablePath:'C:/Users/Vincent/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
const report = {observedAt:new Date().toISOString(),browser:browser.version(),notes:[],views:[],links:[],references:[]};
try {
 for (const mobile of [false,true]) {
  const context = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
  const page = await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto('https://aegispay-live.vercel.app/',{waitUntil:'networkidle'});
  for(const tab of ['Run','Policy','Audit']) {
   await page.getByRole('tab',{name:tab,exact:true}).click();
   await page.getByRole('tabpanel',{name:tab,exact:true}).waitFor();
   await page.screenshot({path:out+`${mobile?'mobile':'desktop'}-${tab.toLowerCase()}.png`,fullPage:true});
   if(mobile && tab==='Run') await page.screenshot({path:out+'mobile-first-viewport.png'});
   report.views.push({mobile,tab,http:response.status(),...await page.evaluate(()=>({innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,selected:document.querySelector('[aria-selected=true]').textContent,tabRects:[...document.querySelectorAll('[role=tab]')].map(x=>({text:x.textContent,width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height})),h1:document.querySelectorAll('h1').length,panel:document.querySelector('[role=tabpanel]').innerText}))});
  }
  await page.getByRole('tab',{name:'Policy',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  report.notes.push({mobile,arrowRight:await page.evaluate(()=>({focused:document.activeElement.textContent,selected:document.querySelector('[aria-selected=true]').textContent}))});
  await page.keyboard.press('Enter');
  report.notes.push({mobile,enter:await page.locator('[aria-selected=true]').innerText()});
  await page.getByRole('tab',{name:'Run',exact:true}).click();
  if(!mobile){
   for(const name of ['GitHub repository','Pitch PDF (docs/submission/AegisPay-pitch-draft.pdf)']) {
    try {const popupWait=page.waitForEvent('popup'); await page.getByRole('link',{name,exact:true}).click(); const popup=await popupWait; await popup.waitForLoadState('domcontentloaded'); report.links.push({name,url:popup.url(),title:await popup.title()}); await popup.close();}catch(e){report.links.push({name,error:String(e)})}
   }
   for(const link of await page.locator('.list a').all()){
    const href=await link.getAttribute('href');
    try{const popupWait=page.waitForEvent('popup');await link.click();const popup=await popupWait;await popup.waitForLoadState('domcontentloaded');await popup.waitForTimeout(1500); report.links.push({href,url:popup.url(),title:await popup.title(),body:(await popup.locator('body').innerText()).split('Signatures')[0].slice(0,1800)});await popup.close();}catch(e){report.links.push({href,error:String(e)})}
   }
   await page.getByRole('link',{name:'Health JSON',exact:true}).click();
   report.links.push({name:'Health JSON',url:page.url(),body:await page.locator('body').innerText()});
  }
  report.notes.push({mobile,pageErrors:errors});
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 for(const [name,url] of [['linear','https://linear.app/'],['stripe','https://stripe.com/payments'],['langsmith','https://www.langchain.com/langsmith/observability']]) {
  const page=await context.newPage();
  try{const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.waitForTimeout(1800);await page.screenshot({path:out+`reference-${name}.png`});report.references.push({name,url,status:r.status(),title:await page.title()});}catch(e){report.references.push({name,url,error:String(e)})}
  await page.close();
 }
 await context.close();
} finally {await writeFile(out+'browser-observations.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({views:report.views.map(({panel,...rest})=>rest),links:report.links,notes:report.notes,references:report.references},null,2));
