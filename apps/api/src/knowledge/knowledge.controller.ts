import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Post, Query, Req } from '@nestjs/common';
import { openAIClientFor } from '../common/openai-client';
import { CredentialResolver } from '../integrations/credential.resolver';
import { requireUserId, type AuthenticatedRequest } from '../integrations/integrations.controller';
import { PrismaService } from '../prisma/prisma.service';
import {
  deleteDocument,
  getDocumentText,
  knowledgeConnectionString,
  listDocuments,
  requireKnowledgeBaseName,
} from './knowledge.store';
import { ingestDocument, requireDocumentTitle } from './knowledge.ingest';

async function orBadRequest<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : String(error));
  }
}

/** Adding, listing and removing the documents in a Knowledge node's knowledge base. */
@Controller('knowledge')
export class KnowledgeController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CredentialResolver) private readonly resolver: CredentialResolver,
  ) {}

  @Get('documents')
  list(
    @Query('integrationId') integrationId: string,
    @Query('knowledgeBase') knowledgeBase: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = requireUserId(req);
    return orBadRequest(async () => {
      const connectionString = await knowledgeConnectionString(this.resolver, userId, integrationId);
      return { documents: await listDocuments(connectionString, requireKnowledgeBaseName(knowledgeBase)) };
    });
  }

  /** Splits the text into chunks, embeds them with the user's OpenAI key and stores them. */
  @Post('documents')
  @HttpCode(200)
  add(
    @Body() body: { integrationId?: string; knowledgeBase?: string; title?: string; text?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = requireUserId(req);
    return orBadRequest(async () => {
      const title = requireDocumentTitle(body.title);
      const text = typeof body.text === 'string' ? body.text : '';
      const knowledgeBase = requireKnowledgeBaseName(body.knowledgeBase);
      const connectionString = await knowledgeConnectionString(this.resolver, userId, body.integrationId);
      const client = await openAIClientFor(this.prisma, userId);
      const chunks = await ingestDocument(client, connectionString, knowledgeBase, title, text);
      return { ok: true, document: title, chunks };
    });
  }

  /** A document's full text, to edit it on the canvas. */
  @Get('documents/content')
  content(
    @Query('integrationId') integrationId: string,
    @Query('knowledgeBase') knowledgeBase: string,
    @Query('document') document: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = requireUserId(req);
    return orBadRequest(async () => {
      const title = requireDocumentTitle(document);
      const connectionString = await knowledgeConnectionString(this.resolver, userId, integrationId);
      const text = await getDocumentText(connectionString, requireKnowledgeBaseName(knowledgeBase), title);
      if (text === null) throw new Error(`There is no document "${title}".`);
      return { document: title, text };
    });
  }

  @Delete('documents')
  @HttpCode(200)
  remove(
    @Query('integrationId') integrationId: string,
    @Query('knowledgeBase') knowledgeBase: string,
    @Query('document') document: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = requireUserId(req);
    return orBadRequest(async () => {
      const title = requireDocumentTitle(document);
      const connectionString = await knowledgeConnectionString(this.resolver, userId, integrationId);
      await deleteDocument(connectionString, requireKnowledgeBaseName(knowledgeBase), title);
      return { ok: true };
    });
  }
}
