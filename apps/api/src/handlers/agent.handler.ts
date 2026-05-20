import { createDecipheriv, createHash } from 'crypto';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import type { NodeHandler } from './base.handler';
import { isNodeInput } from '../runs/node-input';
import { resolveTools } from './tools/registry';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_MAX_ITERATIONS = 10;

function getEncryptionKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('API_KEY_ENCRYPTION_SECRET must be set to at least 32 characters.');
  }

  return createHash('sha256').update(secret).digest();
}

function decryptApiKey(encryptedApiKey: string) {
  const [ivValue, tagValue, encryptedValue] = encryptedApiKey.split('.');

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid encrypted API key payload.');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export class AgentHandler implements NodeHandler {
  private readonly logger = new Logger(AgentHandler.name);

  constructor(private readonly prisma = new PrismaClient()) {}

  async execute(params: Record<string, unknown>, input: unknown): Promise<unknown> {
    const nodeInput = isNodeInput(input) ? input : { data: input };
    const userId = params.userId ?? params.workflowOwnerId;
    const model = params.model ?? 'gpt-4o-mini';
    let prompt: string = typeof params.prompt === 'string' ? params.prompt : '';
    const maxIterations =
      typeof params.maxIterations === 'number' ? params.maxIterations : DEFAULT_MAX_ITERATIONS;

    // tools param: array of tool names the canvas node opted in to, e.g. ['http_request']
    const enabledToolNames = Array.isArray(params.tools)
      ? (params.tools as string[]).filter(t => typeof t === 'string')
      : [];

    this.logger.log(
      `Starting agent node: model=${String(model)} enabledTools=${enabledToolNames.join(',') || 'none'} input=${formatLogValue(input)}`,
    );

    if (typeof userId !== 'string' || !userId) {
      throw new Error('Agent node requires workflow owner userId.');
    }
    if (typeof model !== 'string' || !model) {
      throw new Error('Agent node model must be a non-empty string.');
    }
    if (!prompt) {
      throw new Error('Agent node prompt must be a non-empty string.');
    }

    if (nodeInput.schema) {
      prompt = `${prompt}\n\n## Available Database Schema\n${nodeInput.schema}`;
    }

    const apiKey = await this.prisma.userApiKey.findUnique({
      where: { userId_provider: { userId, provider: 'OPENAI' } },
      select: { encryptedKey: true },
    });

    if (!apiKey) {
      throw new Error('No OpenAI API key configured for workflow owner.');
    }

    const client = new OpenAI({ apiKey: decryptApiKey(apiKey.encryptedKey) });
    const tools = resolveTools(enabledToolNames);

    this.logger.log(`Resolved tools: ${tools.map(tool => tool.definition.name).join(',') || 'none'}`);

    // ── Working memory: full conversation lives here for the duration of the run ──
    const userContent =
      typeof nodeInput.data === 'string' && nodeInput.data.trim()
        ? nodeInput.data
        : nodeInput.data != null && nodeInput.data !== ''
        ? JSON.stringify(nodeInput.data)
        : null;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: prompt },
      ...(tools.length > 0
        ? [
            {
              role: 'system' as const,
              content:
                'You have access to enabled runtime tools. Use them when they are relevant. If the user asks to search, browse, look up current information, find URLs, or verify recent facts, call the web_search tool before answering.',
            },
          ]
        : []),
      ...(userContent != null
        ? [{ role: 'user' as const, content: userContent }]
        : []),
    ];

    // ── ReAct loop ────────────────────────────────────────────────────────────────
    // Each iteration: call LLM → if tool call, run tool + append result → repeat.
    // Loop exits when the LLM returns a plain text response (finish_reason: 'stop')
    // or we hit the max iterations guard.
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const response = await client.chat.completions.create({
        model,
        messages,
        ...(tools.length > 0
          ? { tools: tools.map(t => ({ type: 'function' as const, function: t.definition })) }
          : {}),
      });

      const choice = response.choices[0];
      if (!choice) throw new Error('LLM returned no choices.');

      const assistantMessage = choice.message;
      this.logger.log(
        `Agent iteration ${iteration + 1}: finishReason=${choice.finish_reason ?? 'unknown'} toolCalls=${assistantMessage.tool_calls?.map(toolCall => toolCall.function.name).join(',') || 'none'}`,
      );
      // Append the assistant turn to working memory so the next iteration has full context.
      messages.push(assistantMessage);

      // LLM is done — no tool calls, just a final answer.
      if (choice.finish_reason === 'stop' || !assistantMessage.tool_calls?.length) {
        return assistantMessage.content ?? '';
      }

      // LLM wants to call one or more tools — execute each and feed results back.
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const tool = tools.find(t => t.definition.name === toolName);

        let toolResult: string;
        if (!tool) {
          toolResult = `Error: tool "${toolName}" is not available on this agent node.`;
          this.logger.warn(toolResult);
        } else {
          try {
            const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
            this.logger.log(`Running tool "${toolName}" with args=${formatLogValue(args)}`);
            toolResult = await tool.run(args, { userId });
            this.logger.log(`Tool "${toolName}" completed with result=${formatLogValue(toolResult)}`);
          } catch (err) {
            toolResult = `Error running tool "${toolName}": ${err instanceof Error ? err.message : String(err)}`;
            this.logger.error(toolResult);
          }
        }

        // Append tool result to working memory before next LLM call.
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    }

    // Max iterations reached — return whatever the last assistant message was.
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    const content = lastAssistant && 'content' in lastAssistant ? lastAssistant.content : null;
    return typeof content === 'string' ? content : 'Agent reached max iterations without a final answer.';
  }
}

function formatLogValue(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) {
    return 'undefined';
  }

  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}
