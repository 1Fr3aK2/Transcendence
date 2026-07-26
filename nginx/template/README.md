# nginx — `default.conf.template`

Documentation for the nginx configuration (reverse proxy + WAF) of the transcendence project, accompanying the PR for this branch (`feat/nginx-security-headers`, which also includes the earlier work on rate limiting and forum routing).

## General structure

The file defines two `server{}` blocks:

- **Port `${PORT}` (80)** — only exists to redirect all HTTP traffic to HTTPS (`301`), and to expose `/stub_status` (used by the container's healthcheck and by Prometheus's `nginx_exporter`).
- **Port `${SSL_PORT}` (443)** — where all the real logic lives: TLS, WAF (ModSecurity), security headers, rate limiting, and the proxy to the various internal services (frontend, backend, Grafana, Prometheus).

Variables (`${PORT}`, `${SERVER_NAME}`, `${SSL_CERT_FILE}`, etc.) are substituted at startup by the `envsubst` mechanism in the `owasp/modsecurity-crs` image, from the values defined under `environment:` in `docker-compose.yml`. **The filename must end in `.template`** — that suffix is what the image's startup script uses to know which files to process.

## Rate limiting

Two active zones, with different values depending on the sensitivity of the action being protected:

```nginx
limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=forum:10m rate=30r/s;
```

| Zone | Applied to | Limit | Burst | Why |
|---|---|---|---|---|
| `login` | `/auth/login` | 10 requests/minute per IP | 5 | Sensitive action (account access) — protects against brute-force by IP. Complemented by a per-account rate limit in the backend (Redis), documented in `RATE_LIMITING.md`. |
| `forum` | `/forum` | 30 requests/second per IP | 5 | General browsing + content-creation traffic — generous limit, only meant to contain abnormal traffic/blunt DoS, not to distinguish reads from writes (that distinction is left to a fine-grained rate limit in the backend, still pending — see "Limitations" below). |

The `api` zone is commented out — it was removed as an active `location` because the backend doesn't use the `/api` prefix (routes are direct, e.g. `/auth/login`, `/forum/...`). Kept commented as a reference in case the team decides to adopt that convention in the future.

## Security headers

Applied once, in the port-443 `server{}` block (before the `location{}` blocks), to cover every response from that server:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

- **`Strict-Transport-Security` (HSTS)** — instructs the browser to never try HTTP with this domain again after the first HTTPS visit, closing the man-in-the-middle attack window that would otherwise exist with only the 301 redirect (which still protects the first connection, but depends on that initial HTTP request not being intercepted before it reaches the server).
- **`X-Content-Type-Options: nosniff`** — prevents the browser from reinterpreting a file's type based on content instead of trusting the declared `Content-Type` (relevant mitigation on the forum endpoints, where users publish content).
- **`X-Frame-Options: DENY`** — prevents the site from being loaded inside an `<iframe>` on another domain (clickjacking protection). Chose `DENY` over `SAMEORIGIN` because the frontend doesn't use iframes of its own domain.
- **`Referrer-Policy: strict-origin-when-cross-origin`** — prevents a page's full path (potentially carrying sensitive information in a query string) from being sent in the `Referer` header to external sites; for internal navigation and HTTPS→HTTPS across domains, it still keeps enough for analytics.

**Tested with:**
```bash
curl -k -I https://localhost/
```
Confirmed: all 4 headers present in the response with the expected values.

## Locations per backend module

Each backend module has its own `location`, matching exactly the real route prefix in NestJS (nginx has no way to know this on its own — it has to be maintained manually every time a new module is added):

```nginx
location /auth/login {
    proxy_pass http://backend:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    limit_req zone=login burst=5 nodelay;
}

location /forum {
    proxy_pass http://backend:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    limit_req zone=forum burst=5 nodelay;
}
```

`/forum` (no trailing slash) catches, by prefix, any route underneath it (`/forum/posts`, `/forum/posts/:id/comments`, `/forum/reports`, etc.) — no need for a `location` per individual endpoint, only per module.

## Other services

```nginx
location /ws { ... }          # WebSocket (live BTC price / trades), no rate limit — persistent connection, not individual requests
location /grafana/ { ... }    # Monitoring dashboard
location /prometheus/ { ... } # Metrics
```

No dedicated rate limit — these aren't endpoints exposed to end users of the application (internal team use).

## Known limitations / future work

- **The forum's rate limit is IP-only, not per-user.** The `ForumController`'s write endpoints (`createPost`, `createComment`, `createReport`) don't yet have authentication implemented, nor a `userId` available — reported to the teammate responsible for the forum module. Once that exists, the fine-grained per-user rate limit should be done in the backend (reusing the `RateLimiterService` already built for login), not in nginx — nginx can't cleanly distinguish users or HTTP methods within the same path.
- **`X-Frame-Options: DENY`** was chosen as the more restrictive option due to lack of concrete confirmation about iframe usage in the frontend; reconsider `SAMEORIGIN` if a real need arises.
- **Backend migrations** (`backend_migrate` in `docker-compose.yml`) were the root cause of a 500 bug that interfered with testing this `.conf` — documented separately in `RATE_LIMITING.md`, but relevant for anyone testing this PR: confirm `backend_migrate` runs successfully before validating the endpoints.