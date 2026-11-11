/** Save only structural official schema fragments; no provider credentials. */
import { mkdir } from 'node:fs/promises';
import { OUT, jsonGET, exclusive, sha } from './common.mjs';
const url='https://api-docs.render.com/openapi/render-public-api-1.json';
const schema=await jsonGET(url);
function expand(v,seen=[]){
  if(Array.isArray(v))return v.map(x=>expand(x,seen));
  if(!v||typeof v!=='object')return v;
  if(v.$ref){if(seen.includes(v.$ref))throw Error('CYCLIC_SCHEMA');const target=v.$ref.slice(2).split('/').reduce((a,k)=>a[k.replaceAll('~1','/').replaceAll('~0','~')],schema);return expand(target,[...seen,v.$ref]);}
  const result={};for(const [k,x]of Object.entries(v))if(['type','required','enum','properties','items','oneOf','anyOf','allOf','additionalProperties','minimum','maximum','nullable'].includes(k))result[k]=k==='properties'?Object.fromEntries(Object.entries(x).map(([n,s])=>[n,expand(s,seen)])):expand(x,seen);return result;
}
const operations={};
for(const [name,p,m]of [['create','/services','post'],['environment','/services/{serviceId}/env-vars','put'],['deploy','/services/{serviceId}/deploys','post'],['suspend','/services/{serviceId}/suspend','post']]){
 const operation=schema.paths[p][m];operations[name]={method:m.toUpperCase(),path:p,request:operation.requestBody?expand(operation.requestBody.content['application/json'].schema):null};
}
await mkdir(OUT,{recursive:true});await exclusive(OUT+'/official-schema.json',{fetched_at:new Date().toISOString(),url,canonical_json_sha256:sha(JSON.stringify(schema)),operations,outbound_ips:expand(schema.components.schemas.outboundIps),official_internal_tls:'https://render.com/docs/postgresql-creating-connecting#ssl-modes-for-internal-connections'});
process.stdout.write(JSON.stringify({outcome:'passed',operations:Object.keys(operations)})+'\n');
