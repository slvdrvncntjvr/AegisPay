/** Login headers precede every body/status/cache/cookie assertion. */
import {sha} from './common.mjs';
export class SessionTracking{
 constructor(hashes,secrets){this.hashes=hashes;this.secrets=secrets;this.attempts=[];}
 begin(){const attempt={headers:false,identity:false,rejected:false};this.attempts.push(attempt);return attempt;}
 headers(attempt,status,cookies){
  attempt.headers=true;
  for(const value of cookies){
   for(const match of value.trim().matchAll(/(?:^|[,\n]\s*)aegispay_session=([A-Za-z0-9_-]{43})(?=;|$)/g)){
    this.hashes.add(sha(match[1]));this.secrets.add(match[1]);attempt.identity=true;
   }
  }
  // These exact application rejections precede session creation. Other
  // missing identities, including a lost response, remain uncertain.
  attempt.rejected=!attempt.identity&&[400,401,403,429].includes(status);
 }
 summary(){return{login_requests:this.attempts.length,identified_sessions:this.hashes.size,uncertain_commits:this.attempts.filter(a=>!a.identity&&!a.rejected).length};}
}
export async function fetchWithSessionTracking(url,options,tracking){
 const login=(options.method??'GET')==='POST'&&new URL(url).pathname==='/api/session';
 const attempt=login?tracking.begin():null;
 const response=await fetch(url,options);
 if(attempt)tracking.headers(attempt,response.status,response.headers.getSetCookie());
 return response;
}
