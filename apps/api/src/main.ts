import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // rawBody keeps the exact request bytes, which Slack's signature check needs.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors();

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

void bootstrap();
