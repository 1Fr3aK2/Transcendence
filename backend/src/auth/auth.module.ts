import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { RateLimiterModule } from '../rate-limiter/rate-limiter.module';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    PrismaModule,
    RateLimiterModule,
    PassportModule,

    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: {
        expiresIn: '1d',
      },
    }),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
  ],

  exports: [
    RolesGuard,
  ],
})
export class AuthModule {}
