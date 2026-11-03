import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // rawBody keeps the exact request bytes, which Slack's signature check needs.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.enableCors();
  // Knowledge documents and uploaded files (base64) arrive as JSON, so allow more than the 100kb default.
  app.useBodyParser('json', { limit: '8mb' });

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

void bootstrap();
