/** No-op without a NEW reviewed private qualification permit. */
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { PRIVATE,check,sha } from './common.mjs';
import {recordObservedExit,readTerminal} from '../staging-app/evidence-terminal.ts';
import {OUT} from './common.mjs';
const permit=JSON.parse(await readFile(PRIVATE+'/permit-qualify.json','utf8'));
check(process.argv.length===2&&permit.task==='TASK-020'&&permit.operation==='qualify'&&permit.coordinator_reviewed===true&&Date.parse(permit.expires_at)>Date.now(),'REVIEWED_REMOTE_QUALIFICATION_REQUIRED');
for(const name of ['qualify.mjs','qualify.ts','common.mjs'])check(permit.helper_hashes[name]===sha(await readFile('deployment/finals/preview/'+name)),'QUALIFICATION_HELPER_CHANGED');
const child=spawn(process.execPath,['--import','tsx','deployment/finals/preview/qualify.ts'],{stdio:'inherit',windowsHide:true,env:process.env});
child.once('close',async code=>{try{await recordObservedExit(OUT+'/qualification',code??1,'preview entry observed actual qualifier child close');const t=await readTerminal(OUT+'/qualification');check(t.accepted,'REMOTE_TERMINAL_EVIDENCE_INCONSISTENT');process.exitCode=t.passed?0:1;}catch{process.stderr.write('QUALIFIER_TERMINAL_BINDING_FAILED\n');process.exitCode=1;}});child.once('error',()=>{process.stderr.write('QUALIFIER_START_FAILED\n');process.exitCode=1;});
