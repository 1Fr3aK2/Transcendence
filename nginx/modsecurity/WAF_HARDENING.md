# WAF/ModSecurity Hardening (`nginx/modsecurity/`)

This document describes hardening the WAF for the "WAF/ModSecurity (hardened)
+ HashiCorp Vault for secrets" module (the WAF half — see `VAULT_PRODUCTION.md`
for the Vault half).

## Overview

The project uses the `owasp/modsecurity-crs:4-nginx` image, which bundles
Nginx, ModSecurity, and the OWASP Core Rule Set (CRS). Out of the box it runs
with `PARANOIA=1`, the CRS's most permissive detection level — enough to be
"a WAF exists", but not enough to be considered hardened.

## What changed

```yaml
environment:
  PARANOIA: "2"
  BLOCKING_PARANOIA: "2"
volumes:
  - ./nginx/modsecurity/before-crs.conf:/etc/modsecurity.d/owasp-crs/rules/REQUEST-900-EXCLUSION-RULES-BEFORE-CRS.conf
  - ./nginx/modsecurity/exclusions.conf:/etc/modsecurity.d/owasp-crs/rules/RESPONSE-999-EXCLUSION-RULES-AFTER-CRS.conf
```

- **`PARANOIA` / `BLOCKING_PARANOIA` raised to 2** — the CRS distinguishes
  detection level (what's evaluated/logged) from blocking level (what's
  actually rejected); both were set to 2. Level 3 was considered but
  rejected as likely overkill for this project's scope, generating
  significantly more false positives for marginal extra protection.
- **`REQUEST-900-EXCLUSION-RULES-BEFORE-CRS.conf`** and
  **`RESPONSE-999-EXCLUSION-RULES-AFTER-CRS.conf`** are placeholder files the
  CRS itself expects to be overridden for local exclusions — one for rules
  that must run *before* the CRS loads (e.g. setting `tx.allowed_methods`),
  one for rules that run *after* (e.g. `SecRuleRemoveById`). Using these,
  rather than editing the CRS's own rule files, keeps customizations isolated
  and upgrade-safe.

## `before-crs.conf` — allowing REST methods

```apache
SecAction \
  "id:900200,\
  phase:1,\
  nolog,\
  pass,\
  t:none,\
  setvar:'tx.allowed_methods=GET HEAD POST OPTIONS PATCH PUT DELETE'"
```

The CRS's method-enforcement rule (`911100`) only allows
`GET HEAD POST OPTIONS` by default. This project's REST API relies on
`PATCH` (e.g. `PATCH /forum/posts/:id`, `PATCH /forum/reports/:id/resolve`)
and would need `DELETE`/`PUT` too, so without this exclusion every
partial-update endpoint was rejected by the WAF before it ever reached the
backend. `id:900200` is a locally-chosen ID inside the CRS's reserved range
for custom rules (900000–900999), avoiding collisions with CRS rule IDs.

This is a WAF-level allowance only — it does not grant any application
permission. Whether a specific user is allowed to edit or delete a specific
post is authorization logic that belongs to (and is enforced by) the
backend, not the WAF. The WAF only decides whether the HTTP method is
permitted to exist for this API at all.

## `exclusions.conf` — Vite dev server false positive

```apache
SecRuleRemoveById 930121
```

Rule `930121` (Local File Inclusion detection) flags any request whose
`Referer` header contains the string `node_modules/` — a legitimate
heuristic against LFI attempts, but it also matches the Vite dev server's
own asset requests (`/node_modules/.vite/deps/...`), which are normal in
development.

**This is a dev-mode-specific exclusion.** The frontend currently runs via
the Vite dev server, not a production build. If/when the frontend is served
as a static production build, `node_modules/`-referencing requests should no
longer occur, and this exclusion may no longer be necessary — worth
revisiting at that point rather than assuming it should stay indefinitely.

## Verification

Both false positives above were found by testing real application flows end
to end, not assumed:

- `/forum` GETs (posts, comments, listing) — clean, no false blocks.
- `/forum/reports`, `/forum/moderation/*` (POST, PATCH) — initially blocked
  by the method-enforcement rule; fixed by `before-crs.conf`; confirmed the
  request now reaches the backend (a `400` from the app's own DTO validation,
  not a `403` from the WAF).
- Attack simulation confirms actual protection, not just that the container
  starts:
  - `POST /forum/posts` with `' OR 1=1 --` in the body → `403` (WAF)
  - `POST /forum/posts` with `<script>alert(1)</script>` in the body →
    `403` (WAF)

## How to test

1. `docker compose up -d nginx` after any change to these files.
2. Exercise real app flows (forum posts, comments, reports, moderation) and
   confirm nothing legitimate gets an HTML `403 Forbidden` page (a JSON
   error from the app itself, e.g. `400`/`404`, is fine — that means the
   request passed the WAF).
3. If something is blocked, `docker compose logs nginx | grep -i
   modsecurity` shows the matched rule ID and message — identify whether
   it's a genuine false positive (add a scoped exclusion) or a real risk
   (leave it blocking).
4. Confirm real attacks are still blocked:
   ```bash
   curl -k -X POST https://localhost/forum/posts \
     -H "Content-Type: application/json" \
     -d '{"title":"test","content":"'"'"' OR 1=1 --"}'
   curl -k -X POST https://localhost/forum/posts \
     -H "Content-Type: application/json" \
     -d '{"title":"test","content":"<script>alert(1)</script>"}'
   ```
   Both should return `403`.

## Status

- [x] `PARANOIA`/`BLOCKING_PARANOIA` raised from default (1) to 2
- [x] Method enforcement extended for PATCH/PUT/DELETE (REST API requirement)
- [x] Vite dev-server false positive excluded, with a note to revisit for
      production builds
- [x] Verified against real app traffic (forum flows) with no unresolved
      false positives
- [x] Verified against simulated SQLi/XSS attacks — both blocked
