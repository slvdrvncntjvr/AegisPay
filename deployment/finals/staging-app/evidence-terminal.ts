/** Exclusive terminal evidence protocol. A result alone NEVER establishes pass.
 * Consumers require result + inventory + finalization + externally observed exit.
 */
import { createHash } from 'node:crypto';
import { readFile, open } from 'node:fs/promises';
import path from 'node:path';
export const sha=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const json=(v:unknown)=>JSON.stringify(v,null,2)+'\n';
export type TerminalFault='VALIDATION'|'BEFORE_INVENTORY'|'AFTER_INVENTORY'|'AFTER_RESULT'|'BEFORE_FINALIZATION';
export async function exclusive(p:string,text:string){const file=await open(p,'wx');try{await file.writeFile(text);await file.sync();}finally{await file.close();}}
export async function publishTerminal(directory:string,result:Record<string,any>,entries:unknown[],validate:(text:string)=>void,fault?:TerminalFault){
  const body={...result,requires_terminal_finalization_and_observed_exit:true};
  const resultText=json(body);
  const inventoryText=json({at:new Date().toISOString(),files:[...entries,{path:'result.json',bytes:Buffer.byteLength(resultText),sha256:sha(resultText)}]});
  const expectedExit=body.outcome==='passed'?0:1;
  const finalization={phase:'TERMINAL',outcome:body.outcome,exit_code:expectedExit,all_validation_completed:true,result_sha256:sha(resultText),inventory_sha256:sha(inventoryText)};
  const finalizationText=json(finalization);
  // Complete all validation BEFORE publishing any success-related artifact.
  if(fault==='VALIDATION')throw new Error('INJECTED_VALIDATION_FAILURE');
  for(const text of [resultText,inventoryText,finalizationText])validate(text);
  if(fault==='BEFORE_INVENTORY')throw new Error('INJECTED_INVENTORY_FAILURE');
  await exclusive(path.join(directory,'inventory.json'),inventoryText);
  if(fault==='AFTER_INVENTORY')throw new Error('INJECTED_AFTER_INVENTORY_FAILURE');
  await exclusive(path.join(directory,'result.json'),resultText);
  if(fault==='AFTER_RESULT')throw new Error('INJECTED_AFTER_RESULT_FAILURE');
  if(fault==='BEFORE_FINALIZATION')throw new Error('INJECTED_FINALIZATION_FAILURE');
  await exclusive(path.join(directory,'finalization.json'),finalizationText);
  return{...finalization,finalization_sha256:sha(finalizationText)};
}
export async function recordObservedExit(directory:string,code:number,source='external command runner observed actual process exit'){
  const name=path.join(directory,'finalization.json');let digest:string|null=null;
  try{digest=sha(await readFile(name));}catch{}
  await exclusive(path.join(directory,'observed-exit.json'),json({exit_code:code,finalization_sha256:digest,source}));
}
export async function readTerminal(directory:string){
  try{
    const [r,i,f,e]=await Promise.all(['result.json','inventory.json','finalization.json','observed-exit.json'].map(p=>readFile(path.join(directory,p))));
    const result=JSON.parse(r.toString()),inventory=JSON.parse(i.toString()),finalization=JSON.parse(f.toString()),observed=JSON.parse(e.toString());
    const consistent=result.requires_terminal_finalization_and_observed_exit===true&&finalization.phase==='TERMINAL'&&finalization.all_validation_completed===true&&finalization.result_sha256===sha(r)&&finalization.inventory_sha256===sha(i)&&observed.finalization_sha256===sha(f)&&observed.exit_code===finalization.exit_code&&result.outcome===finalization.outcome&&(result.outcome==='passed'?finalization.exit_code===0:finalization.exit_code===1);
    const entry=inventory.files.find((x:any)=>x.path==='result.json');
    if(!consistent||entry?.sha256!==sha(r))return{accepted:false,safe_failure:'TERMINAL_BINDING_OR_EXIT_INCONSISTENT'};
    return{accepted:true,passed:result.outcome==='passed'&&observed.exit_code===0,result,inventory,finalization,observed_exit:observed,finalization_sha256:sha(f)};
  }catch{return{accepted:false,safe_failure:'TERMINAL_ARTIFACTS_OR_OBSERVED_EXIT_MISSING'};}
}
