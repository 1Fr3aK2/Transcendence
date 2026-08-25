import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedKey = process.env.ADMIN_API_KEY;

    if (!expectedKey) {
      throw new InternalServerErrorException(
        'Admin API key is not configured',
      );
    }

    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-api-key'];

    if (typeof providedKey !== 'string') {
      throw new UnauthorizedException('Invalid API key');
    }

    const providedHash = createHash('sha256')
      .update(providedKey)
      .digest();

    const expectedHash = createHash('sha256')
      .update(expectedKey)
      .digest();

    if (!timingSafeEqual(providedHash, expectedHash)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
