import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (process.env.SENTRY_DSN) {
      const status = exception instanceof HttpException ? exception.getStatus() : 500;
      if (!(exception instanceof HttpException) || status >= 500) {
        Sentry.captureException(exception);
      }
    }
    super.catch(exception, host);
  }
}
