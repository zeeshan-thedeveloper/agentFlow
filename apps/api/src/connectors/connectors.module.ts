import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RunsModule } from '../runs/runs.module';
import { ConnectorStore } from './connector.store';
import { ConnectorsController } from './connectors.controller';
import { HooksController } from './hooks.controller';
import { TriggerDispatcher } from './trigger.dispatcher';

@Module({
  imports: [RunsModule],
  controllers: [ConnectorsController, HooksController],
  providers: [
    PrismaService,
    TriggerDispatcher,
    { provide: ConnectorStore, useFactory: (prisma: PrismaService) => new ConnectorStore(prisma), inject: [PrismaService] },
  ],
})
export class ConnectorsModule {}
