import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.validator';

async function bootstrap(): Promise<void> {
  validateEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

void bootstrap();
