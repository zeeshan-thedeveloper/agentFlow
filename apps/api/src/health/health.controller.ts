import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  liveness() {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Get('ready')
  async readiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  }
}
