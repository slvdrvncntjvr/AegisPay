import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, interpolate, Img, OffthreadVideo, staticFile} from 'remotion';
import proof from '../../../evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794064999769.json';
const ink='#e9f5f5', muted='#a6bfc8', accent='#5be0bb';
const Card:React.FC<{index:number,title:string,children:React.ReactNode}>=({index,title,children})=>{
 const f=useCurrentFrame();return <AbsoluteFill style={{background:'#07131b',color:ink,fontFamily:'Segoe UI, sans-serif',padding:'42px 64px',opacity:interpolate(f,[0,8],[0,1],{extrapolateRight:'clamp'})}}>
 <div style={{display:'flex',justifyContent:'space-between',color:accent,fontSize:18,letterSpacing:2}}><b>AEGISPAY / TESTNET</b><span>SAVED PROOF REPLAY · {index} / 7</span></div>
 <h1 style={{fontSize:42,margin:'22px 0 18px'}}>{title}</h1>{children}
 <div style={{position:'absolute',bottom:22,left:64,right:64,borderTop:'1px solid #28404b',paddingTop:12,display:'flex',justifyContent:'space-between',fontSize:17,color:muted}}><span>aegispay-live.vercel.app</span><span>One saved authorization · no new purchase · model run not shown</span></div>
 </AbsoluteFill>;
};
const P:React.FC<{children:React.ReactNode}>=({children})=><p style={{fontSize:25,lineHeight:1.42,color:muted,margin:'12px 0'}}>{children}</p>;
const Code:React.FC<{children:React.ReactNode}>=({children})=><div style={{background:'#102731',border:'1px solid #2e5360',borderRadius:12,padding:20,marginTop:20,fontFamily:'Consolas, monospace',fontSize:20,lineHeight:1.5,overflowWrap:'anywhere'}}>{children}</div>;
export const Demo:React.FC=()=> <AbsoluteFill style={{background:'#07131b'}}>
 <Sequence from={0} durationInFrames={300}><Card index={1} title="Agent payments, bounded by owner policy">
 <P>AegisPay explores API purchasing for agents using Noir authorization and Velo Gas on Stellar Testnet.</P>
 <Code>Current delivery: public saved-proof console<br/>Verified integration spike: 7 November 2026<br/>Full model application and hosted purchase: not demonstrated here</Code>
 <P>This replay opens the real deployed website and inspects the recorded agent-key request, matching authorization and separate merchant claim.</P>
 </Card></Sequence>
 <Sequence from={300} durationInFrames={510}><Card index={2} title="The real public proof console">
 <div style={{position:'relative',height:430,overflow:'hidden',border:'1px solid #2e5360',borderRadius:10}}><OffthreadVideo src={staticFile('website.webm')} muted style={{width:'100%',height:'100%',objectFit:'contain',background:'#090d15'}}/></div>
 <div style={{fontSize:19,color:muted,marginTop:10}}>Actual anonymous browser recording · Policy → Run → Audit · saved Testnet facts</div>
 </Card></Sequence>
 <Sequence from={810} durationInFrames={480}><Card index={3} title="Actual saved agent-key authorization request">
 <P>The configured headless agent key authorized this request. No LLM decision or protected report delivery is claimed by the spike.</P>
 <Code>agent: {proof.authorization.agent}<br/>merchant: {proof.authorization.merchant}<br/>amount: {proof.authorization.amount} stroops / 0.03 Testnet XLM<br/>nonce: {proof.authorization.nonce} · operation: {proof.operationId}<br/>asset: {proof.authorization.asset}</Code>
 <P>Historical owner cap: 1,000,000 stroops. The recorded policy has expired; this is evidence review.</P>
 </Card></Sequence>
 <Sequence from={1290} durationInFrames={570}><Card index={4} title="Noir authorization, sponsored by Velo">
 <P>Velo reservation identity and independently verified transaction identities map to one successful authorization at ledger {proof.authorization.ledger}.</P>
 <Code>Velo request: {proof.veloIdentity.requestId}<br/>inner Noir call: {proof.authorization.innerHash}<br/>outer fee-bump: {proof.authorization.outerHash}</Code>
 <P>Request identity was saved before dispatch. Unknown outcomes stay unresolved; observation does not sign or submit again.</P>
 <P>Fee evidence: outer ledger {proof.authorization.outerLedgerFeeChargedStroops} = Velo {proof.authorization.veloActualFeeStroops} stroops.</P>
 </Card></Sequence>
 <Sequence from={1860} durationInFrames={540}><Card index={5} title="Evidence must agree before access">
 <P>The saved verifier matched the successful envelope, agent, merchant, asset, amount, nonce, configured contract and embedded Noir event.</P>
 <Code>Observed event transaction: {proof.authorization.observedEventTransactionHash}<br/>event: {proof.authorization.eventId}<br/>contract: {proof.contracts.paymentEscrow}</Code>
 <P>The event alone lacks agent, asset and nonce. Inner, outer and event hashes keep distinct roles until verified.</P>
 <P>Multiple observations are still one purchase. This replay makes no new financial handoff.</P>
 </Card></Sequence>
 <Sequence from={2400} durationInFrames={480}><Card index={6} title="Over-cap refusal; merchant claim is separate">
 <Code>Refused: 1,200,000 stroops against a 1,000,000 cap<br/>AgentNotAuthorized · actual unsigned simulation<br/>includedTransaction = false · signedOrSubmitted = false</Code>
 <P>Authorization moved 300,000 stroops into merchant-pending escrow. A separate merchant-signed claim later cleared pending to zero.</P>
 <Code>claim: {proof.claim.hash}<br/>claim ledger: {proof.claim.ledger}</Code>
 </Card></Sequence>
 <Sequence from={2880} durationInFrames={480}><Card index={7} title="Inspect the source and the submitted links">
 <P>Public proof console: https://aegispay-live.vercel.app</P>
 <P>Source: github.com/slvdrvncntjvr/AegisPay</P>
 <P>Pitch stays at docs/submission/AegisPay-pitch-draft.pdf</P>
 <Code>Delivered here: deployed proof slice + real Testnet evidence replay<br/>Next refresh: verified auth, Gemini tool trace and full app UI<br/>No complete-MVP release or competition eligibility claim</Code>
 <P>Testnet only. No secrets or signed agent XDR appear in this video.</P>
 </Card></Sequence>
</AbsoluteFill>;
