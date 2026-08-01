import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ForumModule } from './forum/forum.module';
import { ModerationModule } from './moderation/moderation.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    ForumModule,
    ModerationModule,
	  AuthModule,
	  HealthModule,
    MetricsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
