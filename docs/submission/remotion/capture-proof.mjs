import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
const require=createRequire(resolve('../../../node_modules/@playwright/test/package.json'));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto('https://aegispay-live.vercel.app',{waitUntil:'networkidle'});
 const links=await page.locator('a').evaluateAll(as=>as.map(a=>({text:a.textContent,href:a.href})));
 const tx=links.filter(l=>l.href.startsWith('https://stellar.expert/explorer/testnet/tx/'));
 if(tx.length!==3) throw Error(`Expected three proof links, got ${tx.length}`);
 const mobile=[];
 for(const tab of ['Policy','Run','Audit']){
   await page.setViewportSize({width:390,height:844});
   await page.getByRole('tab',{name:tab,exact:true}).click();
   await page.getByRole('tabpanel',{name:tab,exact:true}).waitFor();
   const scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
   mobile.push({tab,viewportWidth:390,scrollWidth,overflow:scrollWidth>390});
   await page.screenshot({path:`captures/mobile-${tab.toLowerCase()}.png`,fullPage:true});
 }
 await page.setViewportSize({width:1440,height:900});
 await page.goto(tx[0].href,{waitUntil:'domcontentloaded'});
 await page.getByText('5607680',{exact:false}).first().waitFor({timeout:30000});
 await page.screenshot({path:'public/explorer.png',fullPage:false});
 await writeFile('captures/proof-links.json',JSON.stringify({observedAt:new Date().toISOString(),links:tx,mobile,explorerText:await page.locator('body').innerText()},null,2));
 console.log(JSON.stringify({proofLinkCount:tx.length,mobile}));
 if(mobile.some(x=>x.overflow))process.exitCode=1;
}finally{await browser.close();}
