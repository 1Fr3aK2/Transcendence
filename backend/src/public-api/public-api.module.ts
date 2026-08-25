import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { ForumModule } from '../forum/forum.module';
import { UsersModule } from '../users/users.module';
import { RateLimiterModule } from '../rate-limiter/rate-limiter.module';

@Module({
  imports: [
    ForumModule,
    UsersModule,
    RateLimiterModule,
  ],
  controllers: [PublicApiController],
})
export class PublicApiModule {}
