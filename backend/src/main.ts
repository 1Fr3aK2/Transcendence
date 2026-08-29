import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  const document = SwaggerModule.createDocument(
    app,
    config,
    {
      include: [PublicApiModule],
    },
  );

  SwaggerModule.setup(
    'api/admin/docs',
    app,
    document,
  );
  
  await app.listen(8000);
}
bootstrap();