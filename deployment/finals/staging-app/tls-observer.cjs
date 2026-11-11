// Observes the unmodified production application's real pg Pool. No credentials,
// certificates, connection parameters, queries or server errors are logged.
const pg = require('pg');
const { checkServerIdentity } = require('node:tls');
const { createHash } = require('node:crypto');
const expected = 'feaa345c7d4172d22feb6dd8c92794128061a2f357b2e5372c0739138b6f8f85';
const original = pg.Pool.prototype.connect;
const observed = new WeakSet();
pg.Pool.prototype.connect = function (...args) {
  if (!observed.has(this)) {
    observed.add(this);
    this.on('connect', client => {
      const stream = client.connection.stream;
      const host = client.connectionParameters.host;
      const ssl = client.connectionParameters.ssl;
      const identity = createHash('sha256').update(host.split('.')[0]).digest('hex') === expected;
      const hostname = stream.encrypted === true && !checkServerIdentity(host, stream.getPeerCertificate());
      const mismatchRejected = stream.encrypted === true && checkServerIdentity('qualification.invalid', stream.getPeerCertificate())?.code === 'ERR_TLS_CERT_ALTNAME_INVALID';
      const configured = !!ssl && ssl.rejectUnauthorized !== false && !ssl.checkServerIdentity;
      const result = { resource_matches: identity, encrypted: stream.encrypted === true, authorized: stream.authorized === true,
        hostname_verified: hostname, wrong_hostname_rejected: mismatchRejected, strict_configuration: configured,
        protocol: stream.getProtocol?.(), pool_max: this.options.max, connections_at_observation: this.totalCount };
      process.stdout.write('[staging-tls]' + JSON.stringify(result) + '\n');
    });
  }
  return original.apply(this, args);
};
