import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createHash, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { loadSecretsFromVault } from './vault/vault-bootstrap';
import { PublicApiModule } from './public-api/public-api.module';

async function bootstrap() {
  await loadSecretsFromVault();

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Protege o Swagger da Public Admin API com a mesma verificação
  // de X-API-Key usada no AdminApiKeyGuard, antes do SwaggerModule.setup.
  app.use(
    ['/api/admin/docs', '/api/admin/docs-json'],
    (req: Request, res: Response, next: NextFunction) => {
      const expectedKey = process.env.ADMIN_API_KEY;

      if (!expectedKey) {
        res.status(500).send('Admin API key is not configured');
        return;
      }

      const providedKey = req.headers['x-api-key'];

      if (typeof providedKey !== 'string') {
        res.status(401).send('Unauthorized');
        return;
      }

      const providedHash = createHash('sha256').update(providedKey).digest();
      const expectedHash = createHash('sha256').update(expectedKey).digest();

      if (
        providedHash.length !== expectedHash.length ||
        !timingSafeEqual(providedHash, expectedHash)
      ) {
        res.status(401).send('Unauthorized');
        return;
      }

      next();
    },
  );

  const config = new DocumentBuilder()
    .setTitle('Transcendence Public Admin API')
    .setDescription(
      'Public administrative API for managing users, forum content and moderation.',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
      },
      'admin-api-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [PublicApiModule],
  });

  SwaggerModule.setup('api/admin/docs', app, document);

  await app.listen(8000);
}
bootstrap();