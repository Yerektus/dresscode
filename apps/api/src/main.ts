import { existsSync } from 'fs';
import { resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

function loadEnv() {
  const envCandidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../.env'),
    resolve(process.cwd(), '../../.env'),
  ];

  for (const envPath of envCandidates) {
    if (existsSync(envPath)) {
      dotenvConfig({ path: envPath, override: false });
    }
  }
}

loadEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const bodyLimit = process.env.API_BODY_LIMIT ?? '10mb';

  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:8081',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}
bootstrap();
