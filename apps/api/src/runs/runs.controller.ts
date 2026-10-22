import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { requireUserId, type AuthenticatedRequest } from '../integrations/integrations.controller';
import { RunsService } from './runs.service';

@Controller()
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Post('workflows/:id/run')
  runWorkflow(@Param('id') workflowId: string, @Body() body: { input?: unknown }, @Req() req: AuthenticatedRequest) {
    // Only the input is taken from the client; trigger events come from verified webhooks.
    return this.runsService.runWorkflow(workflowId, { input: body?.input }, requireUserId(req));
  }

  @Get('runs/:id/steps')
  findSteps(@Param('id') runId: string, @Req() req: AuthenticatedRequest) {
    return this.runsService.findSteps(runId, requireUserId(req));
  }
}
