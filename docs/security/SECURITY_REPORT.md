# Cybersecurity & DevOps Report — ft_transcendence

## Role & Scope

This report consolidates the work delivered under the **Cybersecurity / DevOps / Monitoring** role for the ft_transcendence project: Docker, deployment, HTTPS, secrets, WAF/Vault, logs, monitoring, security testing, and technical documentation.

It brings together, into a single narrative, the individual documents produced along the way:
- `SECURITY_TESTING.md` — infrastructure-level security tests (Redis, Postgres, WAF, Vault)
- `RATE_LIMITING.md` — brute-force/DoS protection design (login)
- `RATE_LIMIT_TESTING.md` — validation of the rate limiting mechanisms
- `NGINX_CONFIG.md` — full nginx configuration reference

Each linked document has the full technical detail; this report gives the overall picture, the reasoning behind key decisions, and an honest account of what's done versus still pending.

---

## 1. Infrastructure Overview

The stack runs entirely on Docker Compose:

- **nginx** (`owasp/modsecurity-crs` image) — reverse proxy, TLS termination, WAF (ModSecurity + OWASP CRS), rate limiting, security headers
- **Vault** (dev mode, AppRole auth) — secrets management for Postgres/Redis credentials
- **Redis** — session/rate-limit storage
- **Postgres** — primary database (via Prisma)
- **Prometheus + Grafana + exporters** (nginx, redis, postgres) — metrics and dashboards
- **backend / frontend / backend_migrate** — the application itself, plus a dedicated migration-runner service

Certificates are generated locally via `mkcert`, trusted by the local machine's CA store.

---

## 2. Security Testing (Infrastructure)

Manual tests were run against the core infrastructure services to validate common attack vectors. Full detail in `SECURITY_TESTING.md`.

| Vector | Result |
|---|---|
| Redis access without authentication | ✅ Rejected (`NOAUTH required`) |
| Postgres default user (`postgres`) | ✅ Doesn't exist |
| Postgres external connection without password | ✅ Rejected |
| SQL Injection (WAF) | ✅ Blocked (403) |
| XSS (WAF) | ✅ Blocked (403) |
| Path Traversal | ✅ Blocked (404, path normalized) |
| Command Injection (WAF) | ✅ Blocked (403) |
| Vault access without token | ✅ Rejected (permission denied) |

**Known dev-only gaps**, documented with production recommendations: exposed Redis/Postgres ports, Vault dev mode (in-memory, no real seal), self-signed certificates, root token used directly, secrets briefly visible in `vault_init` logs.

---

## 3. Rate Limiting & Brute-Force Protection

Implemented in two complementary layers on `/auth/login` (full detail in `RATE_LIMITING.md` and `RATE_LIMIT_TESTING.md`):

- **By IP (nginx)** — `10r/m`, burst 5. Protects against a single attacker hammering the endpoint; doesn't protect against a distributed attack (many IPs, one attempt each against the same account).
- **By account (backend + Redis)** — a custom, reusable `RateLimiterService` in NestJS, using Redis `INCR`+`EXPIRE` for atomic, self-expiring counters. 5 failed attempts / 30-minute window, reset on successful login. Closes the gap the IP-based limit leaves open.

Both mechanisms were validated end-to-end after resolving an unrelated backend bug (see section 5). Test coverage: 4 of 5 planned tests confirmed (IP burst behavior, account blocking, Redis counter/TTL correctness, window expiration). One test (counter reset on successful login) remains blocked — see "Known Gaps" below.

The same `RateLimiterService` was extended to the forum's nginx-level routing (general IP-based limit, `30r/s`), with fine-grained per-user limits on forum write actions (posts, comments, reports) designed but not yet implementable — see section 6.

---

## 4. nginx Configuration & Security Headers

Full reference in `NGINX_CONFIG.md`. Highlights:

- **Per-module routing** — dedicated `location` blocks for `/auth/login` and `/forum`, matching the backend's actual route prefixes (the backend doesn't use an `/api` prefix; this was a deliberate, documented choice rather than an oversight).
- **Security headers**, applied to all HTTPS responses:
  - `Strict-Transport-Security` — closes the man-in-the-middle window on repeat visits
  - `X-Content-Type-Options: nosniff` — prevents MIME-sniffing, relevant given user-generated forum content
  - `X-Frame-Options: DENY` — clickjacking protection, relevant for a platform with sensitive actions (trades, moderation)
  - `Referrer-Policy: strict-origin-when-cross-origin` — limits URL leakage to third parties
- Verified in production via `curl -I`, all four headers present with expected values.

---

## 5. A Real Bug Found Through Testing: Missing Migrations

While validating rate limiting, both `/auth/login` and `/forum/posts` intermittently returned `HTTP 500`. Root-caused via backend logs: a pending Prisma migration (`add_forum_and_moderation`) had never been applied to the database — required tables didn't exist.

**Fix:** added a `backend_migrate` service to `docker-compose.yml` — same image as the backend, runs `prisma migrate deploy` once and exits; the `backend` service now only starts after this completes successfully (`condition: service_completed_successfully`). This mirrors the existing `vault_init` pattern already used elsewhere in the stack, and guarantees migrations are always applied automatically, removing a manual step that had already caused a real incident.

---

## 6. Known Gaps & Future Work

Being transparent about what's still open, rather than presenting the work as fully closed:

- **Forum rate limiting is IP-only, not per-user.** The forum's write endpoints (`createPost`, `createComment`, `createReport`) don't yet have authentication wired up — no guard, no way to identify which user made a request. This was identified and reported to the teammate responsible for the forum module. Once resolved, per-user limits can reuse the existing `RateLimiterService` without new design work.
- **Rate limit reset test (Test 12) is blocked** — verifying that a successful login clears the failed-attempt counter requires a real, working user account, which depends on the registration endpoint being functional. Not a rate-limiting defect; a test-environment dependency.
- **No centralized log aggregation** — current monitoring is metrics-only (Prometheus/Grafana). A tool like Loki would have made diagnosing the migration bug (section 5) faster. Identified as a priority next step.
- **Container hardening** — `no-new-privileges`, `read_only` filesystems where feasible, not yet applied across services.
- **Vault dev mode** — acceptable for the project's scope, but explicitly not production-ready (in-memory secrets, no persistent seal).

---

## 7. Deliverables Produced

- `SECURITY_TESTING.md` — infrastructure security tests
- `RATE_LIMITING.md` — rate limiting design and implementation
- `RATE_LIMIT_TESTING.md` — rate limiting validation tests
- `NGINX_CONFIG.md` — nginx configuration reference
- `SECURITY_REPORT.md` (this document) — consolidated overview
- Working `RateLimiterService` (NestJS, reusable across modules)
- `backend_migrate` service (automated migration runner)
- Corrected `Makefile` (decoupled routine builds from full cache resets)