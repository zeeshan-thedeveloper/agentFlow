import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IntegrationsModule } from './integrations/integrations.module';
import { RunsModule } from './runs/runs.module';
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    WorkflowsModule,
    IntegrationsModule,
    // RunsModule owns workflow execution endpoints and persistence.
    RunsModule,
  ],
})
export class AppModule {}
