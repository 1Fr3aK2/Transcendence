# Metrics Module (`backend/src/metrics`)

## What it does

Exposes a `/metrics` endpoint on the backend, in the format Prometheus expects, so it can be scraped by the existing Prometheus service defined in `docker-compose.yml`.

## Why it was needed

Prometheus was already configured to scrape `backend:8000` (via the `backend` job in `prometheus.yml`), but the backend had no `/metrics` endpoint — the scrape returned `404 Not Found`. As a result, the `up{job="backend"}` metric was always `0`, and the `BackendDown` alerting rule was permanently firing, even though the backend was healthy and responding normally on its other routes.

This module fixes that by adding the missing endpoint, without touching any existing business logic (auth, forum, etc.).

## Implementation

```typescript
import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register(),
  ],
})
export class MetricsModule {}
```

- Uses [`@willsoto/nestjs-prometheus`](https://www.npmjs.com/package/@willsoto/nestjs-prometheus) (backed by [`prom-client`](https://www.npmjs.com/package/prom-client)) — a NestJS wrapper around the standard Prometheus Node.js client.
- `PrometheusModule.register()` automatically registers a `GET /metrics` route with Node.js default metrics enabled (CPU usage, memory, event loop lag, garbage collection stats, etc.) — no manual route or controller needed.
- Registered in `app.module.ts` alongside the other feature modules (`AuthModule`, `ForumModule`, `HealthModule`, etc.), following the same pattern already used in the project.

## Dependencies added

```json
"@willsoto/nestjs-prometheus": "^6.1.0",
"prom-client": "^15.1.3"
```

## Verification

```bash
docker exec -it prometheus wget -O- http://backend:8000/metrics
```

Returns Prometheus-format metrics (previously returned `404`). Confirmed in the Prometheus UI (`https://localhost/prometheus/alerts`) that `BackendDown` transitioned from `FIRING` to `INACTIVE` once the endpoint became available.

## Relation to `health/`

This module is intentionally separate from the existing `health/` module:

- **`health/`** answers "is this service alive?" — a simple up/down check used by Docker healthchecks.
- **`metrics/`** answers "what are this service's detailed numbers over time?" — used by Prometheus for monitoring, dashboards, and alerting.

Different responsibilities, kept in separate modules for clarity as the project grows (e.g., if custom business metrics are added later, they belong here, not in `health/`).