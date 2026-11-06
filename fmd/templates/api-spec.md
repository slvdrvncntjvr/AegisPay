# API Specification

> **Purpose:** contracts between components/services. Use a machine-readable spec format
> (OpenAPI, GraphQL SDL, protobuf) where applicable and link it here.
> Traces back to: system design, technical design.

## Overview
<!-- What this API serves, base URL/namespace, versioning scheme. -->

## Authentication & authorization
<!-- How callers authenticate and what scopes/roles gate each operation. -->

## Endpoints / operations
<!-- Repeat per operation. Each contract gets a STABLE ID: API-001, API-002, …
     Tie each to the F-### it serves so QA can trace endpoint → feature → test. -->

### API-001 — <METHOD> <path> — <name>
- **Serves:** <F-###>
- **Description:**
- **Request schema:** <!-- params, body, types, required/optional -->
- **Response schema:** <!-- success shape + status code -->
- **Auth:** <!-- required scope/role, or explicitly "none — and why that's safe" -->
- **Errors:** <!-- error codes + meaning -->

## Error codes
<!-- Canonical list: code, meaning, when it occurs. -->

## Rate limits
<!-- Limits, scope (per key/user/IP), and behavior on breach. -->

## Versioning
<!-- How versions are expressed and the deprecation policy. -->
