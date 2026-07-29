import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly requestCounter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly requestDuration: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Use the matched route pattern (e.g. "/users/:id"), not the raw URL,
    // so metrics don't explode into one series per unique ID.
    const route = request.route?.path ?? request.url;
    const method = request.method;

    const endTimer = this.requestDuration.startTimer({ method, route });

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = response.statusCode;
          this.requestCounter.inc({ method, route, status_code: statusCode });
          endTimer({ status_code: statusCode });
        },
        error: (err) => {
          const statusCode = err?.status ?? 500;
          this.requestCounter.inc({ method, route, status_code: statusCode });
          endTimer({ status_code: statusCode });
        },
      }),
    );
  }
}