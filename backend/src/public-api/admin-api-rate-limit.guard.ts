import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RateLimiterService } from '../rate-limiter/rate-limiter.service';

@Injectable()
export class AdminApiRateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimiterService: RateLimiterService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const allowed =
      await this.rateLimiterService.checkLimit(
        'admin_api_requests',
        100,
        60,
      );

    if (!allowed) {
      throw new HttpException(
        'API rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
