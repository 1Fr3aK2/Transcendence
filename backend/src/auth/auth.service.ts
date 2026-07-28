import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './login.dto';
import { RateLimiterService } from '../rate-limiter/rate-limiter.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async login(dto: LoginDto) {

    const key = "login_attempts:" + dto.email;
    const allowed = await this.rateLimiter.checkLimit(key, 5, 1800);
    if (!allowed) {
      throw new UnauthorizedException('Email ou password inválidos');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        username: dto.username,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou password inválidos');
    }

    const valid = await bcrypt.compare(
      dto.password,
      user.password,
    );

    if (!valid) {
      throw new UnauthorizedException('Email ou password inválidos');
    }

    await this.rateLimiter.resetLimit(key);

    const payload = {
      sub: user.id,
      username: user.username,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}