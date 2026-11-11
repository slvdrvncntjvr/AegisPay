import {stat,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {check,sha} from './common.mjs';
export const CHROMIUM='C:/Users/Vincent/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';
export async function launchReviewedBrowser(){
 check((await stat(CHROMIUM)).isFile(),'REVIEWED_CHROMIUM_FILE_MISSING');
 const digest=sha(await readFile(CHROMIUM));
 const browser=await chromium.launch({executablePath:CHROMIUM,headless:true});
 return{browser,identity:{executable:CHROMIUM,sha256:digest,version:browser.version(),explicit_executable:true,downloaded:false}};
}
