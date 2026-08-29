# Public Admin API

Public administrative API for the Transcendence project.

This module provides an external REST API for interacting with application data and moderation features. It is separate from the JWT-authenticated API used by the frontend and is protected by an API key.

Base path:

```text
/api/admin
```

Interactive Swagger documentation:

```text
https://localhost/api/admin/docs
```

## Authentication

All Public Admin API endpoints are protected by `AdminApiKeyGuard`.

Clients must provide the API key using the `X-API-Key` header:

```http
X-API-Key: <api-key>
```

The guard reads the expected key from `ADMIN_API_KEY`.

Instead of directly comparing the two strings, both keys are hashed with SHA-256 and compared using Node.js `timingSafeEqual()`.

Missing or invalid API keys return HTTP `401 Unauthorized`.

If `ADMIN_API_KEY` is not configured on the server, the API returns HTTP `500 Internal Server Error`.

The API key is loaded into the backend environment from Vault during container startup.

## Administrative identity

API-key authentication identifies the caller as the external administrative API, but some existing application operations also require a database user ID.

`AdminIdentityService` resolves the configured administrator using `ADMIN_EMAIL` and verifies that the database user has the `ADMIN` role.

This allows the Public API to reuse the existing forum and moderation services instead of bypassing their application logic or hardcoding an administrator ID.

## Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/users` | List users |
| PUT | `/api/admin/users/:id/role` | Change a user's role |
| GET | `/api/admin/reports` | List moderation reports |
| PATCH | `/api/admin/reports/:id/resolve` | Resolve a moderation report |
| GET | `/api/admin/moderation/pending` | List content pending moderation |
| GET | `/api/admin/moderation/logs` | List moderation audit logs |
| POST | `/api/admin/posts` | Create a post as the administrator |
| DELETE | `/api/admin/posts/:id` | Delete an administrator-owned post |

The API exposes eight endpoints and includes GET, POST, PUT, PATCH and DELETE operations.

## Reuse of existing application logic

The Public API does not implement a second copy of the forum, moderation or user-management business logic.

`PublicApiModule` imports the existing:

- `ForumModule`
- `UsersModule`
- `RateLimiterModule`
- `PrismaModule`

`PublicApiController` delegates operations to `ForumService` and `UsersService`.

For operations that require an application user identity, `AdminIdentityService` supplies the configured administrator ID.

This means that existing validation, moderation, ownership and database behavior remains shared between the normal application and the Public Admin API.

## Rate limiting

The Public Admin API has two rate-limiting layers.

### Nginx

Nginx applies an external per-IP rate limit before requests reach NestJS.

Current configuration:

```text
Key:    client IP
Rate:   30 requests/second
Burst:  5 requests
Mode:   nodelay
Status: HTTP 429 when exceeded
```

The corresponding Nginx configuration uses a dedicated `admin_api` rate-limit zone:

```nginx
limit_req_zone $binary_remote_addr zone=admin_api:10m rate=30r/s;
```

and applies it to the Public Admin API with:

```nginx
limit_req zone=admin_api burst=5 nodelay;
limit_req_status 429;
```

This protects the backend from excessive requests coming from a single client IP before those requests reach NestJS.

### Backend + Redis

`AdminApiRateLimitGuard` provides a second rate-limiting layer inside the NestJS backend using the shared `RateLimiterService`.

Current configuration:

```text
Key:    admin_api_requests
Limit:  100 requests
Window: 60 seconds
Status: HTTP 429 when exceeded
```

The guard calls:

```typescript
this.rateLimiterService.checkLimit(
  'admin_api_requests',
  100,
  60,
);
```

The Redis-backed limiter is applied after API-key authentication.

Using Redis keeps the counter outside the Node.js process and allows the existing generic rate-limiting infrastructure to be reused.

The current `admin_api_requests` key is shared by the Public Admin API rather than being a separate counter per API key or per client.

## Swagger / OpenAPI

Swagger documentation is configured in `backend/src/main.ts`.

The OpenAPI configuration defines the `X-API-Key` security scheme:

```text
Type:   apiKey
Header: X-API-Key
```

Only `PublicApiModule` is included when the Swagger document is generated:

```typescript
const document = SwaggerModule.createDocument(
  app,
  config,
  {
    include: [PublicApiModule],
  },
);
```

This means that the documentation describes the Public Admin API rather than every endpoint in the Transcendence backend.

Swagger also allows the API key to be entered using the **Authorize** button and then used when testing protected endpoints.

Interactive documentation is available at:

```text
https://localhost/api/admin/docs
```

The OpenAPI JSON document is available at:

```text
https://localhost/api/admin/docs-json
```

## Testing

A demonstration and integration test script is provided at:

```text
scripts/test-public-api.sh
```

Run it from the project root:

```bash
./scripts/test-public-api.sh
```

The script asks for an API key without displaying it and demonstrates:

- API-key authentication
- GET users
- GET moderation reports
- GET pending moderation content
- GET moderation logs
- PUT user role and restoration of the original role
- POST creation of a temporary post
- DELETE of the created post
- PATCH resolution of a pending report, when one is available
- Nginx rate limiting
- backend Redis rate limiting

The POST/DELETE test is self-contained: the script deletes the post that it creates.

The role test temporarily changes a non-ADMIN user's role and restores the original role afterwards.

The report-resolution test is interactive to avoid unexpectedly modifying moderation data. If no pending report exists, this test is skipped.

The two rate-limiting mechanisms are tested independently:

- Nginx is tested through `https://localhost`;
- the Redis limiter is tested by sending requests directly to the NestJS backend from inside the backend container, bypassing Nginx.

A complete validation run confirmed:

```text
API key authentication           PASS
GET users                        PASS
GET reports                      PASS
GET pending moderation           PASS
GET moderation logs              PASS
PUT user role                    PASS
POST post                        PASS
DELETE post                      PASS
PATCH resolve report             PASS
Nginx rate limiting              PASS
Redis rate limiting              PASS
```

## Main files

```text
backend/src/public-api/
├── public-api.module.ts
├── public-api.controller.ts
├── admin-api-key.guard.ts
├── admin-api-rate-limit.guard.ts
├── admin-identity.service.ts
└── README.md
```

Related files include:

```text
backend/src/main.ts
backend/src/rate-limiter/
scripts/test-public-api.sh
nginx/template/default.conf.template
```

## Security notes

- The Public API uses a separate API-key authentication mechanism from the frontend JWT authentication.
- API keys are not hardcoded in the application source code.
- API-key comparison uses SHA-256 hashes and `timingSafeEqual()`.
- The configured administrator is resolved from the database instead of using a hardcoded user ID.
- `AdminIdentityService` verifies that the configured database user has the `ADMIN` role.
- Existing application validation, moderation and ownership rules are reused where applicable.
- Requests are protected by both Nginx and backend/Redis rate limiting.
- The API key is provided to the backend through the project's Vault integration.

## Known simplifications

This API is designed for the Transcendence project environment rather than a production deployment.

In particular:

- the backend Redis rate limiter currently uses one shared `admin_api_requests` counter for the Public Admin API rather than a per-key or per-client counter;
- the configured API key represents the administrative integration rather than individual external API clients;
- the local HTTPS environment uses project-generated certificates, so command-line tests may require `curl -k`.
