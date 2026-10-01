# Security Testing Report — ft_transcendence

## Context

This document records the security tests performed against the infrastructure of the ft_transcendence project, covering the services configured under the Cybersecurity/DevOps area (item 5).

The tests were performed manually to verify that the services are properly protected and that the infrastructure withstands common attack vectors.

---

## Test Environment

- **System**: WSL2 (Ubuntu) on Windows
- **Docker Compose**: all infrastructure services running
- **Services tested**: Redis, Postgres, nginx/WAF, Vault

---

## Tests Performed

---

### Test 1 — Redis: Access Without Authentication

**Objective**: Verify that Redis rejects unauthenticated connections.

**Attack vector**: Direct connection to Redis without a password via TCP.

**Command**:
```bash
echo "PING" | nc localhost 6379
```

**Result obtained**:
```
-NOAUTH Authentication required.
```

**Expected result**: ✅ Authentication failure

**Conclusion**: Redis rejects any command without prior authentication. The `--requirepass` flag is correctly configured.

**Note**: Port `6379` is exposed on the host to make local development easier. In production, the `ports` section for Redis should be removed from the compose file — the service should only be accessible within the internal Docker network (`transcendence`).

---

### Test 2 — Postgres: Access With the Default User

**Objective**: Verify that the `postgres` user (default root) does not exist.

**Attack vector**: Login attempt using Postgres's default user.

**Command**:
```bash
docker exec -it postgres psql -U postgres
```

**Result obtained**:
```
FATAL: role "postgres" does not exist
```

**Expected result**: ✅ User does not exist

**Conclusion**: The `postgres` user was never created — good practice that makes brute-force attacks using default credentials harder.

---

### Test 3 — Postgres: External Access Without a Password

**Objective**: Verify that Postgres requires authentication for network connections (as an external service or attacker would connect).

**Attack vector**: TCP connection to Postgres from another container, without supplying a password.

**Command**:
```bash
docker run --rm --network transcendence_transcendence postgres:16 psql -h postgres -U <POSTGRES_USER> -d <POSTGRES_DB>
```

**Result obtained**:
```
fe_sendauth: no password supplied
```

**Expected result**: ✅ Requires authentication

**Conclusion**: Postgres requires a password for network (TCP) connections. Local connections via Unix socket (inside the container) use `trust` by default — normal and acceptable behavior in development.

---

### Test 4 — WAF: SQL Injection

**Objective**: Verify that the WAF blocks SQL injection attempts.

**Attack vector**: URL parameter with a typical SQL injection pattern (`OR 1=1`).

**Command**:
```bash
curl -k "https://localhost/api/test?id=1+OR+1=1"
```

**Result obtained**:
```html
<h1>403 Forbidden</h1>
```

**Expected result**: ✅ 403 Forbidden

**Conclusion**: ModSecurity with the OWASP CRS detects and blocks the SQL injection pattern before the request reaches the backend.

---

### Test 5 — WAF: Cross-Site Scripting (XSS)

**Objective**: Verify that the WAF blocks XSS attempts.

**Attack vector**: URL parameter with a `<script>` tag.

**Command**:
```bash
curl -k "https://localhost/?q=<script>alert(1)</script>"
```

**Result obtained**:
```html
<h1>403 Forbidden</h1>
```

**Expected result**: ✅ 403 Forbidden

**Conclusion**: ModSecurity detects and blocks the XSS pattern.

---

### Test 6 — WAF: Path Traversal

**Objective**: Verify that an attacker cannot access system files via path traversal.

**Attack vector**: URL with `../` attempting to move up the directory tree.

**Command**:
```bash
curl -k "https://localhost/../../../etc/passwd"
```

**Result obtained**:
```html
<h1>404 Not Found</h1>
```

**Expected result**: ✅ Access denied (404)

**Conclusion**: nginx normalizes the path before processing it — `/../../../etc/passwd` resolves to `/etc/passwd`, which doesn't exist as an application route. The file is not exposed.

---

### Test 7 — WAF: Command Injection

**Objective**: Verify that the WAF blocks command injection attempts.

**Attack vector**: URL parameter with a command injection pattern (`;cat /etc/passwd`).

**Command**:
```bash
curl -k "https://localhost/?cmd=;cat+/etc/passwd"
```

**Result obtained**:
```html
<h1>403 Forbidden</h1>
```

**Expected result**: ✅ 403 Forbidden

**Conclusion**: ModSecurity detects and blocks the command injection pattern.

---

### Test 8 — Vault: Access to Secrets Without Authentication

**Objective**: Verify that Vault rejects secret-read requests without an authentication token.

**Attack vector**: Direct HTTP request to the Vault API without a token.

**Command (as originally run, against dev-mode Vault)**:
```bash
curl http://localhost:8200/v1/secret/data/postgres
```

**Result obtained (dev-mode Vault)**:
```json
{"errors":["permission denied"]}
```

**Expected result**: ✅ Permission denied

**Conclusion (original, dev-mode Vault)**: Vault rejects any unauthenticated access to secrets. A valid token is required for any operation.

> ⚠️ **Needs re-verification.** This test was run against Vault in dev mode,
> communicating over plain HTTP. Vault has since been hardened (see
> `SECURITY_REPORT.md` §3 / `AUTH_HARDENING_REPORT.md`): it now runs with a
> real `operator init`/unseal and TLS (`VAULT_CACERT`). The `curl` command
> above, using `http://` against port `8200`, may now fail at the connection
> level (TLS required) rather than return the documented
> `{"errors":["permission denied"]}` body — these are two different
> failure modes with different security implications (one confirms
> authorization is enforced; the other only confirms the port isn't speaking
> plain HTTP). **This test should be re-run against the current Vault setup,
> using the CA certificate under `./vault/certs`, before this document is
> treated as fully current** — e.g.:
> ```bash
> curl --cacert ./vault/certs/ca.pem https://localhost:8200/v1/secret/data/postgres
> ```
> and the result above updated with whatever is actually observed, rather
> than assumed to be unchanged.

---

## Results Summary

| # | Service | Attack Vector | Result | Status |
|---|---|---|---|---|
| 1 | Redis | Access without authentication | NOAUTH required | ✅ Secure |
| 2 | Postgres | Default user (`postgres`) | Role does not exist | ✅ Secure |
| 3 | Postgres | External connection without password | No password supplied | ✅ Secure |
| 4 | WAF/nginx | SQL Injection | 403 Forbidden | ✅ Blocked |
| 5 | WAF/nginx | XSS | 403 Forbidden | ✅ Blocked |
| 6 | WAF/nginx | Path Traversal | 404 Not Found | ✅ Secure |
| 7 | WAF/nginx | Command Injection | 403 Forbidden | ✅ Blocked |
| 8 | Vault | Access without token | Permission denied (dev-mode result) | ⚠️ Needs re-verification against hardened Vault + TLS |

---

## Known Limitations and Production Recommendations

| Item | Current State | Production Recommendation |
|---|---|---|
| Redis port exposed (`6379`) | Exposed on host | Remove `ports` from compose — accessible only on the Docker network |
| Postgres port exposed (`5432`) | Exposed on host | Remove `ports` from compose |
| ~~Vault in dev mode~~ | **Resolved** — Vault now runs with a real `operator init -key-shares=5 -key-threshold=3`, persistent storage, and TLS; see `SECURITY_REPORT.md` §3 | — |
| SSL certificates | `mkcert` (self-signed, local) | Use Let's Encrypt or a real certificate |
| Vault root token | Used directly for initial bootstrap | Create tokens with limited, per-service permissions beyond initial setup |
| AppRole credentials (RoleID/SecretID) | **Improved** — now persisted to files under the `vault-approle` volume and consumed directly by `backend`/`backend_seed`, rather than only printed to stdout and requiring manual capture; see `SECURITY_REPORT.md` §3 | Confirm these files are never included in any backup or export that leaves the host unencrypted |

---

## Future Tests

Status updated — several items below are no longer future work:

- ~~Rate limiting — verify that multiple fast requests are throttled~~ — **done.**
  See `RATE_LIMIT_TESTING.md` for the full test suite (IP-based and
  per-account limiting on login, Redis counter/TTL verification, window
  expiration) and `SECURITY_REPORT.md` §4 for the forum and Admin Public API
  rate limiting added since.
- ~~JWT authentication — verify that protected endpoints reject invalid
  tokens~~ — **done**, as part of the hardening pass: a token forged with the
  previously-hardcoded fallback secret (`'secret'`) was confirmed accepted
  *before* the fix and rejected (`401`) *after* it, using `GET /auth/me`. See
  `AUTH_HARDENING_REPORT.md` §2.
- **CORS** — verify that only allowed origins can access the API. Not yet
  tested; still open.
- **Input validation** — verify that the backend rejects malformed input the
  WAF didn't catch. Not yet tested as a dedicated pass; still open.