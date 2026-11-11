# Separate authenticated Free preview — preparation only

This is TASK-020's review packet, based on accepted commit
`edbd15f955190e1b12f93a3990a24248c8ee6318` and application `b2661c0`.
No service, environment transfer, deploy, source publication, database SQL,
login, browser qualification, model, worker or financial action was performed.
The submitted Vercel and PDF URLs remain unchanged.

`request-template.json` is the exact proposed POST `/v1/services` body with one
private owner substitution. It requests one Free Node web service named
`aegispay-auth-preview`, Singapore, repository root, `main`, one instance,
automatic deploy trigger `off`, service previews `off`, `/api/health`, and the
reviewed build/start scripts. It has no disk, autoscaling, pre-deploy command,
paid build tier, worker or provider credential. The initial environment sets
`AEGIS_PREVIEW_ENABLED=0`: any initial provider build fails closed before install
or application startup. Automatic-deploy `off` does not mean service creation
cannot trigger an initial build.

The build pins Node24.22.1 and runs root workspace frozen pnpm12.18.0 install
with dev dependencies, then the web build only. Install/build children receive
an allowlist without DB/auth/provider credentials. Runtime uses normal Next on
`0.0.0.0:$PORT`, root shared/server sources included. A read-only observer emits
safe actual app-pool TLS attestations. Build emits safe source/build/asset
fingerprints; raw logs, secrets and findings never become evidence.

`environment.json` owns the exact transfer names. After review, use independent
48-byte owner/merchant login tokens and receipt key, generated and retained in
new protected preview custody. Copy only existing public staging identities and
Testnet configuration. Existing agent/device remains unprovisioned with zero
policy and nonce. Leave model, wake and proxy-trust names absent. The current UI
disables Start task while the agent is unprovisioned; missing model config also
blocks run creation before a run row. No financial or wallet endpoint is part
of qualification.

## Network decision still required

Authenticated readback resolves the exact internal DB URL privately, but
[Render documents self-signed internal TLS without verify-full support](https://render.com/docs/postgresql-creating-connecting#ssl-modes-for-internal-connections).
The installed pg8.23.1 / pg-connection-string2.14.1 parser confirms a bare
internal URL does not request TLS; external `sslmode=verify-full` preserves
certificate and hostname checking. No internal connection was attempted and
no internal certificate trust was assumed.

The concrete alternative is the existing exact external hostname with
`sslmode=verify-full`, after reading the new service's official
`GET /services/{serviceId}/outbound-ips` response. `network-plan.mjs` prepares a
private, reviewable exact-DB PATCH preserving the current client /32 and adding
only returned IPv4 /24-or-narrower ranges. It never applies the PATCH. Render's
Free egress uses **shared regional ranges**, so this is not a service-exclusive
allowlist. Unknown/larger ranges stop for separate review. A coordinator must
explicitly decide whether that scoped network expansion is acceptable before
applying it; no broad rule, paid dedicated IP, or internal TLS bypass is used.

## Coordinator continuation

1. Review this packet and its hashes. Inspect current Git/Vercel deployment
   settings again immediately before any source push: current evidence has no
   Vercel Git link, remote `main` at91f9680, and zero repository hooks, but the
   repository hook API cannot prove absence of app-installation hooks.
2. Deliberately commit and publish the reviewed preview helpers plus the accepted
   application closure. No branch or push is done by this packet. The delivery
   commit must descend from the accepted checkpoint, preserve all72 application
   Git blobs and two extra runtime files, and contain exactly the sealed helper
   bytes in `source-closure.json`. Git-blob LF hashes differ from historical
   Windows rehearsal disk hashes; both are recorded explicitly. Pin the actual
   new delivery SHA in each future permit, environment and deploy request.
3. Create a NEW protected `permit-create.json` in the new custody directory using
   the fields below. Run `node deployment/finals/preview/apply.mjs create` once.
   Re-read the returned exact service and HTTPS URL. The initial build remains
   closed; no DB/auth credential is present. An uncertain create consumes its
   marker: reconcile by identity/name instead of resending it.
4. Run `node deployment/finals/preview/network-plan.mjs` once. Review its private
   request and authorize/apply only that exact external allowlist change through
   a separately reviewed coordinator action, then record exact readback. The
   preparation's previous allowlist must still match or this step stops.
5. Issue `permit-environment.json` with the explicit network approval flag, then
   `node deployment/finals/preview/apply.mjs environment`. This generates the
   independent credentials once and replaces only the new service's environment.
   Read the environment back privately; no unexpected names or values are allowed.
6. Issue `permit-deploy.json`, then `node deployment/finals/preview/apply.mjs deploy`.
   The request uses `commitId` equal to the exact published delivery SHA and
   `clearCache: do_not_clear`. Wait for the actual provider outcome through
   bounded coordinator observation; this handoff has no deploy-status polling.
7. Only after provider live/source/env/network readback and natural DB/login
   budget check, issue `permit-qualify.json` and run the prepared gate:

   ```text
   node deployment/finals/preview/qualify.mjs
   ```

   The entry validates its private permit before starting the locally resolved
   tsx helper. It checks expected URL/owned IDs/source/env, strict helper TLS and
   16 prior revoked sessions, then bounded cold readiness, anonymous HTML/RSC,
   built assets, exact HTTPS origin/cookies/no-store, real HTTP roles and four
   actual HTTPS browser role/viewport flows. It rejects missing browser bodies;
   no later GET or fabricated CDP event substitutes for them. Route interception
   only aborts forbidden traffic, never fulfills a response. It scans findings,
   secrets, state, storage and bodies in memory, with no screenshots or traces.
   Provider build/TLS log attestations must match the exact commit. Final DB
   counts require22 total revoked sessions, six new hashes, all11 execution and
   financial tables empty, original migrations and unprovisioned identity.
   Cleanup revokes only invocation-observed session hashes, even on failure.
   Result/inventory/finalization require the entry's separately observed child
   exit. No remote gate has run in this preparation.
8. Stop exposure on failure using a NEW exact-service `permit-suspend.json` and
   `node deployment/finals/preview/apply.mjs suspend`; no delete/paid fallback or
   action against the old DB/Vercel project is prepared. For a later rollback,
   Render Free only supports two previous deploys; this first service has no
   qualified previous deployment, so suspension is the initial rollback.

Each apply permit contains `task: TASK-020`, the exact `operation`,
`coordinator_reviewed: true`, future `expires_at`, `request_template_sha256`,
`source_closure_sha256` and full40-character `source_commit`. Non-create permits
also pin `expected_service_id`; environment additionally requires
`external_verify_full_network_approved: true`. Qualification permits pin
`expected_service_id`, exact `expected_origin`, `source_commit`, expiry and
`helper_hashes` for `qualify.mjs`, `qualify.ts`, `common.mjs`. None of these real
permits exists in this handoff. Operation attempt markers are exclusive and
durable before dispatch; failure or unknown outcome never authorizes a resend.

Free preview limits: idle spin-down after15minutes, roughly1minute cold wake,
ephemeral filesystem, monthly shared free-hour/build/bandwidth limits and
possible service suspension. The exact DB expires
2026-12-10T11:55:40.452333Z. No billing activation or paid recovery is authorized.
[Free limits](https://render.com/docs/free),
[official Next deployment](https://render.com/docs/deploy-nextjs-app),
[API service schema](https://api-docs.render.com/reference/create-service),
[outbound ranges](https://render.com/docs/outbound-ip-addresses).
