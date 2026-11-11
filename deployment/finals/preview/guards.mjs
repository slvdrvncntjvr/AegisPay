import {check,NAME} from './common.mjs';
export function assertCreate(r){
 check(r.type==='web_service'&&r.name===NAME&&r.repo==='https://github.com/slvdrvncntjvr/AegisPay'&&r.branch==='main'&&r.rootDir===''&&r.autoDeployTrigger==='off','EXACT_MANUAL_PREVIEW_REQUEST_REQUIRED');
 check(Object.keys(r).sort().join(',')===['type','name','ownerId','repo','branch','rootDir','autoDeployTrigger','envVars','serviceDetails'].sort().join(','),'UNEXPECTED_CREATE_FIELD');
 const d=r.serviceDetails;
 check(d.runtime==='node'&&d.plan==='free'&&d.region==='singapore'&&d.numInstances===1&&d.healthCheckPath==='/api/health'&&d.previews.generation==='off','FREE_SINGLE_NODE_PREVIEW_REQUIRED');
 check(Object.keys(d).sort().join(',')===['runtime','plan','region','numInstances','previews','healthCheckPath','envSpecificDetails'].sort().join(','),'UNEXPECTED_SERVICE_DETAIL');
 check(d.envSpecificDetails.buildCommand==='node deployment/finals/preview/build.mjs'&&d.envSpecificDetails.startCommand==='node deployment/finals/preview/start.mjs','REVIEWED_WEB_COMMANDS_REQUIRED');
 check(JSON.stringify(r.envVars)===JSON.stringify([{key:'NODE_VERSION',value:'24.22.1'},{key:'NODE_ENV',value:'production'},{key:'NEXT_TELEMETRY_DISABLED',value:'1'},{key:'AEGIS_PREVIEW_ENABLED',value:'0'}]),'CREATE_MUST_HAVE_NO_CREDENTIALS_AND_CLOSED_BUILD_FENCE');
}
export function assertPreviewOrigin(raw){const u=new URL(raw);check(u.protocol==='https:'&&u.origin===raw&&!u.username&&!u.password&&u.hostname.endsWith('.onrender.com'),'EXACT_HTTPS_RENDER_PREVIEW_REQUIRED');}
