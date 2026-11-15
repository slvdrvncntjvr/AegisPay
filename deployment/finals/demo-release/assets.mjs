// Read public hosted HTML/client assets only; report no secret values or bodies.
import assert from 'node:assert/strict';
import { privateEnv, receipt } from './common.mjs';
if(process.argv.length!==3||process.argv[2]!=='--check-public-assets'){
  console.log(JSON.stringify({status:'not_run',code:'EXPLICIT_PUBLIC_ASSET_CHECK_REQUIRED'}));process.exitCode=2;
}else{
  try{
    const web=privateEnv('.env.release.hosted-web.local'),worker=privateEnv('.env.release.hosted-worker.local');
    const secrets=Object.entries({...web,...worker}).filter(([k,v])=>/SECRET|TOKEN|SIGNING_KEY|DATABASE_URL|API_KEY|ENCRYPTION_KEY/.test(k)&&!k.includes('PUBLIC')&&v.length>16).map(([,v])=>v);
    const paths=new Set(),checked=[];
    async function check(path){
      assert(path.startsWith('/')&&!path.startsWith('//'));
      const response=await fetch(web.APP_ORIGIN+path,{redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);
      let bytes=0;const chunks=[];for await(const chunk of response.body){bytes+=chunk.length;assert(bytes<=3*1024*1024);chunks.push(chunk);}
      const text=Buffer.concat(chunks).toString('utf8');assert(!secrets.some(s=>text.includes(s)));assert(!/(?<![A-Za-z0-9])S[A-Z2-7]{55}(?![A-Za-z0-9])/.test(text));
      checked.push({path,bytes});return text;
    }
    for(const path of ['/login','/app']){
      const html=await check(path);
      for(const match of html.matchAll(/(?:src|href)="([^" ]+\.js(?:\?[^" ]*)?)"/g)){
        const url=new URL(match[1].replaceAll('&amp;','&'),web.APP_ORIGIN);assert.equal(url.origin,web.APP_ORIGIN);assert(url.pathname.startsWith('/_next/static/'));paths.add(url.pathname+url.search);
      }
    }
    assert(paths.size>0&&paths.size<=60);for(const path of paths)await check(path);
    const result={status:'passed',observedAt:new Date().toISOString(),scope:'actual-hosted-public-html-and-client-assets',htmlPages:2,clientAssets:paths.size,checked,knownCredentialMatches:0,stellarSecretSeedMatches:0,newFinancialHandoffs:0};
    receipt('public-assets',result);console.log(JSON.stringify({status:'passed',htmlPages:2,clientAssets:paths.size,knownCredentialMatches:0}));
  }catch{console.log(JSON.stringify({status:'failed',code:'PUBLIC_ASSET_CHECK_INCOMPLETE'}));process.exitCode=1;}
}
