import { readFile, open, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
export const OUT='docs/evidence/finals-preview/preparation-2026-11-11';
export const PRIVATE='.fmd-work/preview-custody-2026-11-11';
export const DBHASH='feaa345c7d4172d22feb6dd8c92794128061a2f357b2e5372c0739138b6f8f85';
export const ACCEPTED='edbd15f955190e1b12f93a3990a24248c8ee6318';
export const NAME='aegispay-auth-preview';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const check=(v,c)=>{if(!v)throw Error(c);};
export const envFile=async p=>parseEnv(await readFile(p,'utf8'));
export async function exclusive(p,value){const f=await open(p,'wx',0o600);try{await f.writeFile(typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');await f.sync();}finally{await f.close();}}
export async function protectDirectory(){
  await mkdir(PRIVATE,{recursive:true,mode:0o700});
  if(process.platform==='win32'){
    const q="'"+path.resolve(PRIVATE).replaceAll("'","''")+"'";
    const script=`$ErrorActionPreference='Stop'; $p=${q}; $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $a=Get-Acl -LiteralPath $p; $a.SetAccessRuleProtection($true,$false); foreach($r in @($a.Access)){[void]$a.RemoveAccessRuleSpecific($r)}; foreach($s in @($sid,[System.Security.Principal.SecurityIdentifier]::new('S-1-5-18'))){$a.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))}; Set-Acl -LiteralPath $p -AclObject $a; $v=Get-Acl -LiteralPath $p; if(-not $v.AreAccessRulesProtected -or @($v.Access).Count -ne 2){exit 1}`;
    const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,encoding:'utf8',env:{...process.env,PSModulePath:`${process.env.SystemRoot}/System32/WindowsPowerShell/v1.0/Modules`}});
    check(r.status===0,'PRIVATE_DIRECTORY_ACL_FAILED');
  }
}
export function safe(e){return e instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'DEPENDENCY_OR_NETWORK_FAILED';}
export function cleanNetworkEnvironment(){check(!Object.keys(process.env).some(k=>/^(https?_proxy|all_proxy|node_options|node_extra_ca_certs|node_tls_reject_unauthorized|pg.*)$/i.test(k)),'UNSAFE_NETWORK_ENVIRONMENT');}
export async function jsonGET(url,headers={},limit=8*1024*1024){
  check(url.startsWith('https://'),'HTTPS_REQUIRED');
  const r=await fetch(url,{method:'GET',headers:{'User-Agent':'AegisPay-preview-readonly',Accept:'application/json',...headers},redirect:'error',signal:AbortSignal.timeout(25000)});
  check(r.ok,'READONLY_HTTP_'+r.status);let size=0;const chunks=[];
  for await(const b of r.body){size+=b.length;check(size<=limit,'READONLY_RESPONSE_TOO_LARGE');chunks.push(Buffer.from(b));}
  return JSON.parse(Buffer.concat(chunks).toString());
}
export function git(args){const r=spawnSync('git',args,{encoding:'utf8',windowsHide:true});check(r.status===0,'GIT_READ_FAILED');return r.stdout.trim();}
export function github(endpoint){const r=spawnSync('gh',['api',endpoint],{encoding:'utf8',windowsHide:true});check(r.status===0,'GITHUB_AUTHENTICATED_READ_FAILED');return JSON.parse(r.stdout);}
