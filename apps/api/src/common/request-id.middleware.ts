import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & { id: string };

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    (req as RequestWithId).id = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  }
}
