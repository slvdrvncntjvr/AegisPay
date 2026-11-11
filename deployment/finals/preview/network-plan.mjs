/** Future read-only readback after exactly one preview service exists. No PATCH. */
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import { PRIVATE,OUT,DBHASH,NAME,envFile,jsonGET,check,exclusive,sha,cleanNetworkEnvironment } from './common.mjs';
cleanNetworkEnvironment();
const owned=JSON.parse(await readFile(PRIVATE+'/owned-service.json','utf8'));
const custody=JSON.parse(await readFile(PRIVATE+'/provider-readonly.json','utf8'));
check(owned.name===NAME&&owned.ownerId===custody.ownerId&&sha(custody.databaseId)===DBHASH,'EXACT_OWNED_PREVIEW_REQUIRED');
const env=await envFile('.env.deploy.local'),headers={Authorization:'Bearer '+env.RENDER_API_KEY};
const ips=await jsonGET('https://api.render.com/v1/services/'+encodeURIComponent(owned.id)+'/outbound-ips',headers);
check(ips.type==='shared'&&Array.isArray(ips.ips)&&ips.ips.length>0&&ips.ips.length<=16,'FREE_SHARED_OUTBOUND_IPS_REQUIRED');
for(const value of ips.ips){const [ip,bits]=value.split('/');check(net.isIP(ip)===4&&Number(bits??32)>=24&&Number(bits??32)<=32,'OUTBOUND_RANGE_REQUIRES_SEPARATE_REVIEW');}
const db=await jsonGET('https://api.render.com/v1/postgres/'+encodeURIComponent(custody.databaseId),headers);
check(db.plan==='free'&&db.region==='singapore'&&db.owner?.id===custody.ownerId&&JSON.stringify(db.ipAllowList)===JSON.stringify(custody.previousAllowlist),'EXISTING_DATABASE_OR_RULES_CHANGED');
const proposed=[...db.ipAllowList,...ips.ips.filter(ip=>!db.ipAllowList.some(r=>r.cidrBlock===ip)).map(cidrBlock=>({cidrBlock,description:'Reviewed AegisPay preview Render shared Singapore egress'}))];
await exclusive(PRIVATE+'/network-request.json',{method:'PATCH',path:'/postgres/'+custody.databaseId,body:{ipAllowList:proposed},previous:db.ipAllowList,serviceId:owned.id});
await exclusive(OUT+'/network-review.json',{outcome:'prepared-only',provider_mutations:0,source:'GET /services/{serviceId}/outbound-ips',outbound_type:ips.type,range_count:ips.ips.length,existing_rules_preserved:db.ipAllowList.length,proposed_rule_count:proposed.length,service_exclusive:false,shared_regional_egress:true,network_expansion_requires_explicit_coordinator_review:true,request_sha256:sha(await readFile(PRIVATE+'/network-request.json'))});
process.stdout.write('{"outcome":"prepared-only","network_mutations":0,"shared_regional_egress":true}\n');
