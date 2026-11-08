// Anonymous read-only availability/ledger observation. Never persists signed XDR.
import {readFile,writeFile} from 'node:fs/promises';
const proof=JSON.parse(await readFile('../../evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794064999769.json','utf8'));
const links=[
 'https://aegispay-live.vercel.app',
 'https://aegispay-live.vercel.app/api/health',
 'https://github.com/slvdrvncntjvr/AegisPay',
 'https://github.com/slvdrvncntjvr/AegisPay/blob/main/docs/submission/AegisPay-pitch-draft.pdf',
 'https://drive.google.com/drive/folders/1hqwzOaG_qU9axjcLIjBUb1YeMWdOFq72?usp=sharing',
 ...[proof.authorization.outerHash,proof.authorization.innerHash,proof.claim.hash].map(hash=>`https://stellar.expert/explorer/testnet/tx/${hash}`),
];
const availability=await Promise.all(links.map(async url=>{try{const r=await fetch(url,{signal:AbortSignal.timeout(25000)});return {url,status:r.status,finalUrl:r.url};}catch(e){return {url,error:e.message};}}));
const ledger=await Promise.all([proof.authorization.outerHash,proof.claim.hash].map(async hash=>{
 const url=`https://horizon-testnet.stellar.org/transactions/${hash}`;
 try{const r=await fetch(url,{signal:AbortSignal.timeout(25000)});const j=await r.json();
 return {url,status:r.status,hash:j.hash,successful:j.successful,ledger:j.ledger,createdAt:j.created_at,feeCharged:j.fee_charged,sourceAccount:j.source_account};
 }catch(e){return {url,error:e.message};}
}));
const report={observedAt:new Date().toISOString(),availability,ledger,limits:'GET availability is not full Noir/Velo reverification; safe Horizon fields only, no signed XDR retained. Re-observation is not another purchase.'};
await writeFile('captures/link-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(availability.some(x=>x.status!==200)) process.exitCode=1;
