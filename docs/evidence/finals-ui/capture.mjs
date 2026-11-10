import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('./captures/', import.meta.url));
const base = process.env.UI_BASE_URL ?? 'http://127.0.0.1:3017';
const browser = await chromium.launch({ executablePath: 'C:/Users/Vincent/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', headless: true });
const report = { base, observedAt: new Date().toISOString(), browser: browser.version(), views: [], errors: [] };
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {})));
  });
}
try {
  for (const [name, width, height] of [['desktop',1440,1000],['projector',1280,720],['tablet',768,1024],['mobile390',390,844],['mobile320',320,740]]) {
    const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push({name,message:error.message}));
    const response = await page.goto(base,{waitUntil:'networkidle'});
    await settle(page);
    await page.screenshot({path:out+`${name}-viewport.png`});
    await page.screenshot({path:out+`${name}-full.png`,fullPage:true});
    report.views.push({name,status:response.status(),width,height,...await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,h1:document.querySelectorAll('h1').length,decisionBottom:document.querySelector('.decision-title').getBoundingClientRect().bottom,amountTop:document.querySelector('.amount').getBoundingClientRect().top,fontLoaded:document.fonts.check('600 48px Bricolage')}))});
    if(name==='desktop'){
      await page.getByRole('tab',{name:'Over-cap refusal'}).click();
      await settle(page);
      await page.screenshot({path:out+'desktop-refusal.png'});
      await page.getByRole('tab',{name:'Recovery rule'}).click();
      await settle(page);
      await page.screenshot({path:out+'desktop-recovery.png'});
      await page.getByRole('tab',{name:'Authorization',exact:true}).click();
      await settle(page);
      await page.locator('#receipt > summary').click();
      await page.locator('#receipt').scrollIntoViewIfNeeded();
      await page.screenshot({path:out+'desktop-receipt.png'});
      await page.goto(base+'/login',{waitUntil:'networkidle'});
      await page.screenshot({path:out+'desktop-login.png'});
    }
    if(name==='projector'){
      await page.getByRole('link',{name:'Focus the evidence',exact:true}).click();
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 700)));
      await page.screenshot({path:out+'projector-focused.png'});
    }
    if(name==='mobile320'){
      await page.locator('#receipt > summary').click();
      await page.locator('.technical-details > summary').click();
      report.views.push({name:'mobile320-identities',...await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}))});
      await page.locator('#receipt').scrollIntoViewIfNeeded();
      await page.screenshot({path:out+'mobile320-receipt-viewport.png'});
      await page.locator('.identity').first().scrollIntoViewIfNeeded();
      await page.screenshot({path:out+'mobile320-identity.png'});
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await page.screenshot({path:out+'mobile320-receipt.png',fullPage:true});
      await page.goto(base+'/login',{waitUntil:'networkidle'});
      await page.screenshot({path:out+'mobile320-login.png',fullPage:true});
    }
    await context.close();
  }
} finally { await writeFile(new URL('./browser-results.json',import.meta.url),JSON.stringify(report,null,2)); await browser.close(); }
console.log(JSON.stringify(report,null,2));
