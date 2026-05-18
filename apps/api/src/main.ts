import 'reflect-metadata';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SentryExceptionFilter } from './common/sentry-exception.filter';
import { validateEnv } from './config/env.validator';
import { initSentry } from './sentry';

async function bootstrap(): Promise<void> {
  validateEnv();
  initSentry();
  const app = await NestFactory.create(AppModule);

  if (process.env.SENTRY_DSN) {
    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new SentryExceptionFilter(httpAdapter));
  }

  app.enableCors();

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

void bootstrap();
