/** One offline fault-injection/taxonomy execution, synthetic data only, no DB. */
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { FOLLOWUP } from './continuation.ts';
import { publishTerminal, recordObservedExit, readTerminal, exclusive, sha, type TerminalFault } from './evidence-terminal.ts';
import { classifyStartup, logCategories } from './startup.ts';
const check=(v:unknown,c:string)=>{if(!v)throw new Error(c);};
await mkdir(FOLLOWUP,{recursive:true});
const n=(await readdir(FOLLOWUP)).filter(p=>/^offline-check-\d\.json$/.test(p)).length+1;check(n<=3,'OFFLINE_EXECUTION_LIMIT');
await exclusive(FOLLOWUP+`/offline-execution-${n}.json`,JSON.stringify({at:new Date().toISOString(),kind:'offline synthetic fault injection; no config/DB/network reads'})+'\n');
const result:Record<string,any>={kind:'offline synthetic F1/F2 checks; not application evidence',outcome:'failed',cases:[],startup_classes:[]};
try{
  for(const fault of [undefined,'VALIDATION','BEFORE_INVENTORY','AFTER_INVENTORY','AFTER_RESULT','BEFORE_FINALIZATION'] as (TerminalFault|undefined)[]){
    const directory=FOLLOWUP+`/offline-${n}/${fault??'SUCCESS'}`;await mkdir(directory,{recursive:true});let returned=false;
    try{await publishTerminal(directory,{outcome:'passed',kind:'synthetic offline fixture'},[],()=>{},fault);returned=true;}catch{}
    // Synthetic exit inputs exercise the consumer protocol; they are explicitly
    // modeled values, not claimed actual app/process exits.
    await recordObservedExit(directory,returned?0:1,'synthetic modeled exit for local fault injection');const read=await readTerminal(directory);
    check(fault?!read.accepted:read.accepted&&read.passed,'TERMINAL_FAULT_ACCEPTANCE_FAILED');
    let publishedPassedResult=false;try{publishedPassedResult=JSON.parse(await readFile(directory+'/result.json','utf8')).outcome==='passed';}catch{}
    result.cases.push({fault:fault??'NONE',synthetic_modeled_exit:returned?0:1,published_passed_result:publishedPassedResult,terminal_accepted:read.accepted,passed:read.accepted?read.passed:false});
  }
  const mismatch=FOLLOWUP+`/offline-${n}/EXIT_MISMATCH`;await mkdir(mismatch,{recursive:true});
  await publishTerminal(mismatch,{outcome:'passed',kind:'synthetic exit mismatch'},[],()=>{});await recordObservedExit(mismatch,1,'synthetic modeled exit for local fault injection');
  check(!(await readTerminal(mismatch)).accepted,'MISMATCHED_EXIT_WAS_ACCEPTED');result.cases.push({fault:'OBSERVED_EXIT_MISMATCH',synthetic_modeled_exit:1,terminal_accepted:false});
  for(const [state,expected]of [[{connected:true,spawn_error:null,exited:false},'READY'],[{connected:false,spawn_error:'ENOENT',exited:false},'SPAWN_ERROR'],[{connected:false,spawn_error:null,exited:true},'NATURAL_EXIT'],[{connected:false,spawn_error:null,exited:false},'READINESS_TIMEOUT']] as const){check(classifyStartup(state)===expected,'STARTUP_CLASSIFICATION_FAILED');result.startup_classes.push(expected);}
  check(JSON.stringify(logCategories('Ready in 123ms\nEADDRINUSE'))===JSON.stringify(['READY_BANNER','ADDRESS_IN_USE']),'STARTUP_FIXED_LOG_CATEGORIES_FAILED');
  result.outcome='passed';
}catch(e){result.safe_failure=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'OFFLINE_CHECK_FAILED';}
await exclusive(FOLLOWUP+`/offline-check-${n}.json`,JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify({outcome:result.outcome,execution:n,cases:result.cases.length,safe_failure:result.safe_failure,report:FOLLOWUP+`/offline-check-${n}.json`})+'\n');process.exitCode=result.outcome==='passed'?0:1;
