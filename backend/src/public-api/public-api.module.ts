import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { ForumModule } from '../forum/forum.module';
import { UsersModule } from '../users/users.module';
import { RateLimiterModule } from '../rate-limiter/rate-limiter.module';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminIdentityService } from './admin-identity.service';

@Module({
  imports: [
    ForumModule,
    UsersModule,
    RateLimiterModule,
    PrismaModule,
  ],
  controllers: [PublicApiController],
  providers: [AdminApiKeyGuard, AdminIdentityService],
})
export class PublicApiModule {}
