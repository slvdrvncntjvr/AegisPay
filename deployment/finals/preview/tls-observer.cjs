// Safe evidence from the actual normal Next pg pool; no connection overrides.
const pg=require('pg'),{checkServerIdentity}=require('node:tls'),{createHash}=require('node:crypto');
const original=pg.Pool.prototype.connect,seen=new WeakSet();
pg.Pool.prototype.connect=function(...args){
 if(!seen.has(this)){seen.add(this);this.on('connect',client=>{
  const s=client.connection.stream,p=client.connectionParameters;
  const r={kind:'app_pool_tls',commit:process.env.RENDER_GIT_COMMIT,resource_matches:createHash('sha256').update(p.host.split('.')[0]).digest('hex')==='feaa345c7d4172d22feb6dd8c92794128061a2f357b2e5372c0739138b6f8f85',encrypted:s.encrypted===true,authorized:s.authorized===true,hostname_verified:s.encrypted===true&&!checkServerIdentity(p.host,s.getPeerCertificate()),wrong_hostname_rejected:s.encrypted===true&&checkServerIdentity('preview.invalid',s.getPeerCertificate())?.code==='ERR_TLS_CERT_ALTNAME_INVALID',strict_configuration:!!p.ssl&&p.ssl.rejectUnauthorized!==false&&!p.ssl.checkServerIdentity,protocol:s.getProtocol?.(),pool_max:this.options.max};
  process.stdout.write('[preview-attestation]'+JSON.stringify(r)+'\n');
 });}return original.apply(this,args);
};
