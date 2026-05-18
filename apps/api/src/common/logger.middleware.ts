import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { RequestWithId } from './request-id.middleware';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const reqId = (req as RequestWithId).id ?? '-';

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const path = req.originalUrl ?? req.url;
      this.logger.log(`[${reqId}] ${req.method} ${path} ${res.statusCode} ${durationMs}ms`);
    });

    next();
  }
}
