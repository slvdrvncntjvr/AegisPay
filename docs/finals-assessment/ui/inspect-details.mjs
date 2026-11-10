import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const out=fileURLToPath(new URL('.',import.meta.url));
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/Vincent/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
const result={observedAt:new Date().toISOString()};
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1,reducedMotion:'reduce'});
 await page.goto('https://aegispay-live.vercel.app/',{waitUntil:'networkidle'});
 await page.screenshot({path:out+'projector-1280x720.png'});
 result.rendered=await page.evaluate(()=>{
  const style=(selector)=>{const s=getComputedStyle(document.querySelector(selector));return {color:s.color,background:s.backgroundColor,fontSize:s.fontSize,overflowWrap:s.overflowWrap,minWidth:s.minWidth}};
  return {status:style('.row .status'),body:style('body'),link:style('.list a'),tabSemantics:[...document.querySelectorAll('[role=tab]')].map(x=>({text:x.textContent,id:x.id,tabIndex:x.tabIndex,ariaControls:x.getAttribute('aria-controls')})),panel:{id:document.querySelector('[role=tabpanel]').id,ariaLabelledby:document.querySelector('[role=tabpanel]').getAttribute('aria-labelledby')},mainTop:document.querySelector('.panel').getBoundingClientRect().top,stylesheets:[...document.styleSheets].map(x=>x.href)};
 });
 await page.getByRole('tab',{name:'Policy',exact:true}).focus();
 await page.screenshot({path:out+'keyboard-focus.png'});
 await page.goto('https://linear.app/',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{level:1}).first().waitFor({state:'visible',timeout:30000});
 await page.waitForTimeout(6000);
 await page.screenshot({path:out+'reference-linear-loaded.png'});
 await page.locator('h1').first().scrollIntoViewIfNeeded();
 await page.mouse.wheel(0,500);
 await page.waitForTimeout(1000);
 await page.screenshot({path:out+'reference-linear-product.png'});
 result.linear={title:await page.title(),h1:await page.locator('h1').first().innerText()};
}catch(e){result.error=String(e)}finally{await writeFile(out+'rendered-details.json',JSON.stringify(result,null,2));await browser.close()}
console.log(JSON.stringify(result,null,2));
