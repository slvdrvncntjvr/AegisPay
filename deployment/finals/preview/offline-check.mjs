/** Focused preparation verification only. Does not connect to DB/providers/app. */
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {OUT,PRIVATE,check,sha,exclusive} from './common.mjs';
import {assertCreate,assertPreviewOrigin} from './guards.mjs';
const report={at:new Date().toISOString(),outcome:'failed',scope:'syntax, selected official schema structure, fail-closed guards, installed pg parse and source closure; no DB/provider/browser/login/build',commands:[],cases:[]};
function test(name,fn){fn();report.cases.push({name,passed:true});}
function refuses(fn){let refused=false;try{fn();}catch{refused=true;}check(refused,'UNSAFE_INPUT_NOT_REFUSED');}
function schema(s,v){
 if(s.enum)check(s.enum.includes(v),'SCHEMA_ENUM_FAILED');
 if(s.oneOf){check(s.oneOf.some(t=>{try{schema(t,v);return true;}catch{return false;}}),'SCHEMA_NO_SELECTED_BRANCH');return;}
 if(s.type==='object'){check(v&&typeof v==='object'&&!Array.isArray(v),'SCHEMA_OBJECT_REQUIRED');for(const k of s.required??[])check(k in v,'SCHEMA_REQUIRED_FIELD');for(const[k,x]of Object.entries(v)){check(k in (s.properties??{}),'SCHEMA_UNKNOWN_FIELD');schema(s.properties[k],x);}}
 else if(s.type==='array'){check(Array.isArray(v),'SCHEMA_ARRAY_REQUIRED');for(const x of v)schema(s.items,x);}
 else if(s.type==='integer')check(Number.isInteger(v),'SCHEMA_INTEGER_REQUIRED');else if(s.type)check(typeof v===s.type,'SCHEMA_TYPE_REQUIRED');
}
try{
 const request=JSON.parse(await readFile('deployment/finals/preview/request-template.json','utf8')),official=JSON.parse(await readFile(OUT+'/official-schema.json','utf8'));
 test('exact Free manual Node request',()=>assertCreate(request));
 test('selected official web/native schema fields',()=>{const s=structuredClone(official.operations.create.request);s.properties.serviceDetails=s.properties.serviceDetails.oneOf[1];s.properties.serviceDetails.properties.envSpecificDetails=s.properties.serviceDetails.properties.envSpecificDetails.oneOf[1];schema(s,request);});
 for(const [name,change]of [['paid plan',r=>r.serviceDetails.plan='starter'],['autodeploy',r=>r.autoDeployTrigger='commit'],['extra worker field',r=>r.serviceDetails.preDeployCommand='worker'],['create token',r=>r.envVars.push({key:'DEMO_OWNER_LOGIN_TOKEN',value:'synthetic'})],['replicas',r=>r.serviceDetails.numInstances=2]])test('reject '+name,()=>{const r=structuredClone(request);change(r);refuses(()=>assertCreate(r));});
 test('HTTPS exact preview origin',()=>assertPreviewOrigin('https://aegispay-auth-preview.onrender.com'));
 for(const origin of ['http://aegispay-auth-preview.onrender.com','https://aegispay-live.vercel.app','https://aegispay-auth-preview.onrender.com/path','https://user:pass@aegispay-auth-preview.onrender.com'])test('reject unsafe origin '+report.cases.length,()=>refuses(()=>assertPreviewOrigin(origin)));
 const require=createRequire(import.meta.url),pgRequire=createRequire(require.resolve('pg')),parser=pgRequire('pg-connection-string');
 const fixtureURL=new URL('postgresql://synthetic.singapore-postgres.render.com/synthetic');fixtureURL.username='synthetic';fixtureURL.password='synthetic';fixtureURL.searchParams.set('sslmode','verify-full');
 const external=parser.parse(fixtureURL.href);
 test('installed pg verify-full retains certificate and hostname verification',()=>check(external.ssl&&external.ssl.rejectUnauthorized!==false&&!external.ssl.checkServerIdentity,'VERIFY_FULL_PARSER_UNSAFE'));
 fixtureURL.hostname='synthetic';fixtureURL.search='';const internal=parser.parse(fixtureURL.href);
 test('bare internal URL does not itself request TLS',()=>check(!internal.ssl,'UNEXPECTED_INTERNAL_SSL_DEFAULT'));
 report.installed_pg={version:pgRequire('pg/package.json').version,parser_version:JSON.parse(await readFile(path.join(path.dirname(pgRequire.resolve('pg-connection-string')),'package.json'),'utf8')).version,parser_source_sha256:sha(await readFile(pgRequire.resolve('pg-connection-string'))),external_verify_full_parsed:true,internal_connection_attempted:false,internal_tls_suitability:'official docs state self-signed; verify-full unsupported; not used'};
 const closure=JSON.parse(await readFile('deployment/finals/preview/source-closure.json','utf8'));
 check(sha(JSON.stringify(closure.application_files))===closure.application_sha256,'CANONICAL_APPLICATION_CLOSURE_CHANGED');
 for(const f of [...closure.application_files,...closure.runtime_files]){const r=spawnSync('git',['show',closure.accepted_commit+':'+f.path],{windowsHide:true});check(r.status===0&&sha(r.stdout)===f.git_blob_sha256,'ACCEPTED_GIT_SOURCE_CHANGED');}
 report.accepted_source={commit:closure.accepted_commit,tree:closure.accepted_tree,application_files:closure.application_files.length,runtime_files:closure.runtime_files.length,application_git_blob_closure_sha256:closure.application_sha256,rehearsal_windows_source_sha256:closure.rehearsal_windows_source_sha256};
 for(const name of (await readdir('deployment/finals/preview')).filter(n=>/\.(mjs|cjs|ts)$/.test(n))){const r=spawnSync(process.execPath,['--check','deployment/finals/preview/'+name],{windowsHide:true});report.commands.push({purpose:'syntax',file:name,exit:r.status,output_sha256:sha(Buffer.concat([r.stdout,r.stderr]))});check(r.status===0,'PREVIEW_SOURCE_SYNTAX_FAILED');}
 for(const entry of ['build.mjs','start.mjs']){const r=spawnSync(process.execPath,['deployment/finals/preview/'+entry],{windowsHide:true,env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot}});const expected=entry==='build.mjs'?'PREVIEW_INITIAL_BUILD_FENCED':'PREVIEW_START_FENCED';check(r.status!==0&&r.stderr.includes(expected),'PREVIEW_CLOSED_FENCE_NOT_ENFORCED');report.commands.push({purpose:'expected fail-closed no-op',file:entry,exit:r.status,expected_refusal:expected});}
 const {tsImport}=await import('tsx/esm/api');const {sessionCookie}=await tsImport('../../../src/server/auth/session.ts',import.meta.url);test('actual auth cookie HTTPS flags',()=>check(/; Secure$/.test(sessionCookie('synthetic','https://aegispay-auth-preview.onrender.com'))&&/HttpOnly; SameSite=Strict/.test(sessionCookie('synthetic','https://aegispay-auth-preview.onrender.com')),'ACTUAL_HTTPS_COOKIE_FLAGS_FAILED'));
 report.outcome='passed';
}catch(e){report.safe_failure=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'OFFLINE_CHECK_FAILED';}
await mkdir(OUT,{recursive:true});const index=(await readdir(OUT)).filter(n=>/^offline-check-\d+\.json$/.test(n)).length+1;await exclusive(OUT+'/offline-check-'+index+'.json',report);process.stdout.write(JSON.stringify({outcome:report.outcome,safe_failure:report.safe_failure,cases:report.cases.length,receipt:OUT+'/offline-check-'+index+'.json'})+'\n');process.exitCode=report.outcome==='passed'?0:1;
