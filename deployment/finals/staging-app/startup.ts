/** No DB/application imports. Shared exact spawn/readiness/cleanup diagnostics. */
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { createHash } from 'node:crypto';
export function minimalEnv(extra:Record<string,string>={}){
  const env:Record<string,string>={};
  for(const k of ['SystemRoot','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','LOCALAPPDATA'])if(process.env[k])env[k]=process.env[k]!;
  env.PATH=`${path.dirname(process.execPath)};C:/nvm4w/nodejs/node_modules/corepack/shims;${process.env.SystemRoot}/System32;${process.env.SystemRoot}`;
  return{...env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',COREPACK_ENABLE_NETWORK:'0',...extra};
}
export function classifyStartup(s:{connected:boolean;spawn_error:string|null;exited:boolean}){return s.spawn_error?'SPAWN_ERROR':s.exited?'NATURAL_EXIT':s.connected?'READY':'READINESS_TIMEOUT';}
export function logCategories(raw:string){
  const clean=raw.replace(/\u001b\[[0-9;]*m/g,'');const result:string[]=[];
  for(const [code,pattern]of [['READY_BANNER',/Ready in\s+\d/],['STARTING_BANNER',/Starting/],['NEXT_BANNER',/Next\.js|Next\s+16/],['ADDRESS_IN_USE',/EADDRINUSE/],['MISSING_PRODUCTION_BUILD',/Could not find a production build/],['ERROR_MARKER',/Error:|⨯|Failed to start/]]as const)if(pattern.test(clean))result.push(code);
  return result;
}
const errorEnum=(e:any)=>['ENOENT','EACCES','EPERM','EINVAL','ENOMEM','EADDRINUSE'].includes(e?.code)?e.code:'OTHER_SPAWN_ERROR';
export async function requireFreePorts(){for(const port of [3037,3038])await new Promise<void>((resolve,reject)=>{const server=net.createServer();server.once('error',()=>reject(new Error('OWNED_LOOPBACK_PORT_UNAVAILABLE')));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve()));});}
export class ProductionLaunch{
  readonly child:ChildProcess;private raw='';private spawnError:string|null=null;private exited=false;private started=Date.now();private connected=false;
  private probes=0;private probeCounts={connect:0,refused:0,timeout:0,other:0};
  constructor(next:string,observer:string,cwd:string,env:Record<string,string>,onLog?:(s:string)=>void){
    this.child=spawn(process.execPath,['--require',observer,next,'start','--hostname','127.0.0.1','--port','3038'],{cwd,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    this.child.on('error',e=>{this.spawnError=errorEnum(e);});this.child.on('exit',()=>{this.exited=true;});
    for(const stream of [this.child.stdout,this.child.stderr])stream?.on('data',b=>{const s=b.toString();this.raw+=s;onLog?.(s);});
  }
  snapshot(){
    return{classification:classifyStartup({connected:this.connected,spawn_error:this.spawnError,exited:this.exited||this.child.exitCode!=null||this.child.signalCode!=null}),tcp_ready:this.connected,probes:this.probes,probe_results:this.probeCounts,elapsed_ms:Date.now()-this.started,pre_cleanup_exit_code:this.child.exitCode??null,pre_cleanup_signal_code:this.child.signalCode??null,legacy_strict_exit_code_null:this.child.exitCode===null,spawn_error:this.spawnError,natural_exit_observed:this.exited,log_categories:logCategories(this.raw),log_bytes:Buffer.byteLength(this.raw),log_sha256:createHash('sha256').update(this.raw).digest('hex'),staging_tls_observations:(this.raw.match(/\[staging-tls\]/g)??[]).length};
  }
  async wait(){
    for(let n=0;n<40;n++){
      if(this.exited||this.spawnError)break;this.probes++;
      const status=await new Promise<'connect'|'refused'|'timeout'|'other'>(resolve=>{
        const socket=net.createConnection({host:'127.0.0.1',port:3038});let settled=false;
        const finish=(v:'connect'|'refused'|'timeout'|'other')=>{if(settled)return;settled=true;socket.destroy();resolve(v);};
        socket.setTimeout(500);socket.once('connect',()=>finish('connect'));socket.once('error',(e:any)=>finish(e?.code==='ECONNREFUSED'?'refused':'other'));socket.once('timeout',()=>finish('timeout'));
      });
      this.probeCounts[status]++;if(status==='connect'){this.connected=true;break;}
      await new Promise(r=>setTimeout(r,250));
    }
    return this.snapshot();
  }
  async stop(){
    const before=this.snapshot();if(!this.exited&&!this.spawnError){this.child.kill();await Promise.race([new Promise(r=>this.child.once('exit',r)),new Promise(r=>setTimeout(r,5000))]);}
    return{pid:this.child.pid,before_cleanup:before,owned_process_exited:this.exited||!!this.spawnError,exit_code:this.child.exitCode??null,signal_code:this.child.signalCode??null};
  }
}
