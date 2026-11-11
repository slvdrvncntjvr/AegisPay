/** FUTURE ONLY: each exact mutation needs its own coordinator-created permit.
 * This file is not executed in the preparation handoff. No generic API writer.
 */
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { OUT, PRIVATE, DBHASH, ACCEPTED, NAME, sha, check, exclusive, envFile, safe, cleanNetworkEnvironment, jsonGET, git, github } from './common.mjs';
import {assertCreate,assertPreviewOrigin} from './guards.mjs';
const operation=process.argv[2];
check(['create','environment','deploy','suspend'].includes(operation)&&process.argv.length===3,'EXPLICIT_SINGLE_OPERATION_REQUIRED');
const permitPath=PRIVATE+'/permit-'+operation+'.json';
// Deliberately absent during preparation; no inferred approval or old permit reuse.
const permit=JSON.parse(await readFile(permitPath,'utf8'));
check(permit.task==='TASK-020'&&permit.operation===operation&&permit.coordinator_reviewed===true&&Date.parse(permit.expires_at)>Date.now(),'NEW_PREVIEW_REVIEW_PERMIT_REQUIRED');
cleanNetworkEnvironment();
const template=JSON.parse(await readFile('deployment/finals/preview/request-template.json','utf8'));
assertCreate(template);
check(sha(await readFile('deployment/finals/preview/request-template.json'))===permit.request_template_sha256,'REVIEWED_REQUEST_CHANGED');
const closure=JSON.parse(await readFile('deployment/finals/preview/source-closure.json','utf8'));
check(sha((await readFile('deployment/finals/preview/source-closure.json','utf8')).replaceAll('\r\n','\n'))===permit.source_closure_sha256,'REVIEWED_CLOSURE_CHANGED');
check(/^[a-f0-9]{40}$/.test(permit.source_commit),'EXACT_DELIVERY_COMMIT_REQUIRED');
check(closure.helper_files.length>=10,'SEALED_HELPER_CLOSURE_REQUIRED');
if(operation!=='suspend'){
git(['merge-base','--is-ancestor',ACCEPTED,permit.source_commit]);
const {spawnSync}=await import('node:child_process');
const committedClosure=spawnSync('git',['show',permit.source_commit+':deployment/finals/preview/source-closure.json'],{windowsHide:true});
check(committedClosure.status===0&&sha(committedClosure.stdout)===permit.source_closure_sha256,'COMMITTED_SOURCE_MANIFEST_CHANGED');
for(const f of [...closure.application_files,...closure.runtime_files,...closure.helper_files]){
 // Git text decoding/newline normalization is not used for source hashes.
 const {spawnSync}=await import('node:child_process');const r=spawnSync('git',['show',permit.source_commit+':'+f.path],{windowsHide:true});
 check(r.status===0&&sha(r.stdout)===f.git_blob_sha256,'DELIVERY_SOURCE_CLOSURE_CHANGED');
}
const remote=github('repos/slvdrvncntjvr/AegisPay/commits/'+permit.source_commit);check(remote.sha===permit.source_commit,'DELIVERY_COMMIT_NOT_PUBLISHED');
}
const custody=JSON.parse(await readFile(PRIVATE+'/provider-readonly.json','utf8'));
check(sha(custody.databaseId)===DBHASH,'EXACT_DATABASE_CUSTODY_REQUIRED');
const deploy=await envFile('.env.deploy.local'),auth={Authorization:'Bearer '+deploy.RENDER_API_KEY};
const get=p=>jsonGET('https://api.render.com/v1'+p,auth);
const caller=await get('/users'),members=await get('/owners/'+encodeURIComponent(custody.ownerId)+'/members');
check(members.some(v=>(v.userId===caller.id||v.email&&v.email===caller.email)&&v.role==='ADMIN'&&v.status==='active'),'CURRENT_ACTIVE_ADMIN_REQUIRED');
let owned;
if(operation!=='create'){
 owned=JSON.parse(await readFile(PRIVATE+'/owned-service.json','utf8'));
 check(owned.id===permit.expected_service_id&&owned.name===NAME&&owned.ownerId===custody.ownerId,'OWNED_PREVIEW_IDENTITY_REQUIRED');
 const current=await get('/services/'+encodeURIComponent(owned.id));
 check(current.id===owned.id&&current.name===NAME&&current.ownerId===custody.ownerId&&current.serviceDetails?.plan==='free'&&current.serviceDetails.region==='singapore'&&current.autoDeployTrigger==='off','OWNED_PREVIEW_READBACK_FAILED');
}
let payload,endpoint;
if(operation==='create'){
 const rows=await get('/services?ownerId='+encodeURIComponent(custody.ownerId)+'&includePreviews=true&limit=100');
 check(Array.isArray(rows)&&rows.length<100&&!rows.some(v=>v.service?.name===NAME),'DUPLICATE_OR_INCOMPLETE_PREVIEW_INVENTORY');
 // No credentials at creation. Initial build exits at its enable fence.
 payload={...template,ownerId:custody.ownerId};endpoint='/services';
}else if(operation==='environment'){
 check(permit.external_verify_full_network_approved===true,'EXTERNAL_EGRESS_NETWORK_REVIEW_REQUIRED');
 const stage=await envFile('.env.staging.web.local'),spec=JSON.parse(await readFile('deployment/finals/preview/environment.json','utf8'));
 const config={...spec.fixed,APP_ORIGIN:owned.origin,AEGIS_PREVIEW_SERVICE_ID:owned.id,AEGIS_PREVIEW_COMMIT:permit.source_commit,DATABASE_URL:custody.externalURL};
 for(const k of spec.copy_only_public_staging_values)config[k]=stage[k];
 for(const k of spec.generate_independent_48_byte_base64url_after_review)config[k]=randomBytes(48).toString('base64url');
 check(Object.values(config).every(v=>typeof v==='string'&&v.length),'REQUIRED_PREVIEW_ENV_MISSING');
 await exclusive(PRIVATE+'/preview-environment.json',config);
 payload=Object.entries(config).map(([key,value])=>({key,value}));endpoint='/services/'+encodeURIComponent(owned.id)+'/env-vars';
}else if(operation==='deploy'){
 const config=JSON.parse(await readFile(PRIVATE+'/preview-environment.json','utf8'));
 check(config.AEGIS_PREVIEW_COMMIT===permit.source_commit&&config.APP_ORIGIN===owned.origin,'DEPLOY_ENV_CUSTODY_FAILED');
 payload={commitId:permit.source_commit,clearCache:'do_not_clear'};endpoint='/services/'+encodeURIComponent(owned.id)+'/deploys';
}else endpoint='/services/'+encodeURIComponent(owned.id)+'/suspend';
// This marker is exclusive and durable BEFORE dispatch. An uncertain response
// blocks repeats; reconcile by readback identity, never another create/deploy.
await exclusive(PRIVATE+'/'+operation+'-attempt.json',{at:new Date().toISOString(),operation,source_commit:permit.source_commit,permit_sha256:sha(await readFile(permitPath)),expected_service_id:owned?.id??null});
try{
 const response=await fetch('https://api.render.com/v1'+endpoint,{method:operation==='environment'?'PUT':'POST',headers:{...auth,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{}),redirect:'error',signal:AbortSignal.timeout(30000)});
 check(response.ok,'PREVIEW_MUTATION_REJECTED_'+response.status);
 const data=response.status===204?null:await response.json();
 if(operation==='create'){
   const service=data.service??data;
   check(service.name===NAME&&service.ownerId===custody.ownerId&&service.type==='web_service'&&service.serviceDetails?.plan==='free'&&service.serviceDetails.region==='singapore'&&service.autoDeployTrigger==='off','CREATED_SERVICE_READBACK_FAILED');
   assertPreviewOrigin(service.serviceDetails.url);const url=new URL(service.serviceDetails.url);
   await exclusive(PRIVATE+'/owned-service.json',{id:service.id,name:NAME,ownerId:custody.ownerId,origin:url.origin,initial_deploy_id:data.deployId??null});
 }else if(operation==='deploy')await exclusive(PRIVATE+'/owned-deploy.json',{id:data.id,serviceId:owned.id,commit:permit.source_commit,createdAt:data.createdAt});
 await exclusive(OUT+'/'+operation+'-receipt.json',{at:new Date().toISOString(),outcome:'request-accepted-not-qualified',status:response.status,operation,source_commit:permit.source_commit,service_id_sha256:sha(operation==='create'?(data.service??data).id:owned.id)});
 process.stdout.write(JSON.stringify({outcome:'request-accepted-not-qualified',operation})+'\n');
}catch(e){process.stdout.write(JSON.stringify({outcome:'failed-or-unknown',safe_failure:safe(e),replay_allowed:false})+'\n');process.exitCode=1;}
