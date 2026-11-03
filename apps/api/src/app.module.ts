import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InternalAuthGuard } from './auth/internal-auth.guard';
import { ConfigModule } from '@nestjs/config';
import { ConnectorsModule } from './connectors/connectors.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { FilesModule } from './files/files.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { RunsModule } from './runs/runs.module';
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    WorkflowsModule,
    IntegrationsModule,
    // RunsModule owns workflow execution endpoints and persistence.
    RunsModule,
    // Connected apps (Slack, Telegram, GitHub) and the webhooks that start runs.
    ConnectorsModule,
    // Documents stored in a user's PostgreSQL database for agents to search (RAG).
    KnowledgeModule,
    // Files (such as PDFs agents create) stored in a user's PostgreSQL database.
    FilesModule,
  ],
  // Every route requires the web app's secret or a run token, except the chat webhooks.
  providers: [{ provide: APP_GUARD, useClass: InternalAuthGuard }],
})
export class AppModule {}
