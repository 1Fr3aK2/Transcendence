import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createClient } from 'redis';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as https from 'https';
import * as fs from 'fs';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
  ) {}

  async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  async checkRedis() {
    const client = createClient({
      url: process.env.REDIS_URL,
    });

    await client.connect();

    const pong = await client.ping();

    await client.disconnect();

    if (pong !== 'PONG') {
      throw new Error('Redis is down');
    }
  }

  //changes made by Rafael at 03/08/2026 (checkVault && firstvaluefrom)
  async checkVault() {
    const httpsAgent = new https.Agent({
      ca: fs.readFileSync(process.env.VAULT_CACERT),
    });

    await firstValueFrom(
      this.http.get(`${process.env.VAULT_ADDR}/v1/sys/health`, {
        httpsAgent,
      }),
    );
  }
}