import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Post, Query, Req } from '@nestjs/common';
import { openAIClientFor } from '../common/openai-client';
import { CredentialResolver } from '../integrations/credential.resolver';
import { requireUserId, type AuthenticatedRequest } from '../integrations/integrations.controller';
import { PrismaService } from '../prisma/prisma.service';
import {
  deleteDocument,
  knowledgeConnectionString,
  listDocuments,
  requireKnowledgeBaseName,
  saveDocument,
} from './knowledge.store';
import { chunkText, embed } from './knowledge.text';

const MAX_DOCUMENT_CHARS = 500_000;
const MAX_TITLE_CHARS = 200;

async function orBadRequest<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : String(error));
  }
}

function requireTitle(value: unknown): string {
  const title = typeof value === 'string' ? value.trim() : '';
  if (!title) throw new BadRequestException('Give the document a name.');
  if (title.length > MAX_TITLE_CHARS) throw new BadRequestException(`Document names are at most ${MAX_TITLE_CHARS} characters.`);
  return title;
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
    const title = requireTitle(body.title);
    const text = typeof body.text === 'string' ? body.text : '';
    if (text.length > MAX_DOCUMENT_CHARS) {
      throw new BadRequestException(`A document can be at most ${MAX_DOCUMENT_CHARS.toLocaleString('en-US')} characters; split it into parts.`);
    }
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new BadRequestException('The document has no text.');

    return orBadRequest(async () => {
      const knowledgeBase = requireKnowledgeBaseName(body.knowledgeBase);
      const connectionString = await knowledgeConnectionString(this.resolver, userId, body.integrationId);
      const client = await openAIClientFor(this.prisma, userId);
      const embeddings = await embed(client, chunks);
      await saveDocument(connectionString, knowledgeBase, title, chunks, embeddings);
      return { ok: true, document: title, chunks: chunks.length };
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
    const title = requireTitle(document);
    return orBadRequest(async () => {
      const connectionString = await knowledgeConnectionString(this.resolver, userId, integrationId);
      await deleteDocument(connectionString, requireKnowledgeBaseName(knowledgeBase), title);
      return { ok: true };
    });
  }
}
