import { Controller, Get } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  findAll(): unknown[] {
    return this.workflowsService.findAll();
  }
}
