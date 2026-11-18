# TASK-034 same-link publication plan

Coordinator accepted the tested implementation and explicitly authorizes same-link source/PDF publication plus the existing Finals web and public-proof destinations. Corrected the doubled fictional-parser wording; the fresh full production build and isolated proof packet build pass. Prior local receipts remain intact.

Current primary provider contracts inspected before mutation:

- [Render per-variable update](https://api-docs.render.com/reference/update-env-var): PUT /v1/services/{serviceId}/env-vars/{envVarKey}, body value; applies only to a direct service variable
- [Render trigger deploy](https://api-docs.render.com/reference/create-deploy): POST /v1/services/{serviceId}/deploys with exact commitId and do_not_clear
- [Render list deploys](https://api-docs.render.com/reference/list-deploys): identity/status observation, never a replacement create after uncertainty
- [Vercel deploy](https://vercel.com/docs/cli/deploy): existing --project, --prod --skip-domain and --no-wait
- [Vercel promote](https://vercel.com/docs/cli/promote): promote the already tested production deployment identity

Cached Vercel65.12.1 help confirms --dry JSON and --project without linking; no provider config or environment is copied into proof staging. Fresh preflight confirms owned Free web/worker and autoDeploy off, unchanged active worker, existing proof project and zero proof env/Git auto-deploy link. The new staging namespace/27-file packet never rewrites historical accepted manifests.

All application API/domain/worker/shared/package/lock/config paths are byte-identical between the actual hosted d42cb96 source and the proposed source. Web start executes Next only; no migrations/seed/worker start hook is changed. Authorized mutations are the existing web's AEGIS_RELEASE_COMMIT only, one saved web deploy request, one saved proof candidate and exact-candidate promotion, plus normal fast-forward Git publication. Final checks are anonymous GET-only; no real sessions, tasks, quotes, report reads or financial operations.
