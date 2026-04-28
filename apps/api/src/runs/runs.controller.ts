import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RunsService } from './runs.service';

@Controller()
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Post('workflows/:id/run')
  runWorkflow(@Param('id') workflowId: string, @Body() body: { input?: unknown }) {
    return this.runsService.runWorkflow(workflowId, body);
  }

  @Get('runs/:id/steps')
  findSteps(@Param('id') runId: string) {
    return this.runsService.findSteps(runId);
  }
}
