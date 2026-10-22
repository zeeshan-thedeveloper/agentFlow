import type { Tool } from '../handlers/tools/base.tool';
import type { ConnectorKind, ConnectorStore } from './connector.store';
import { createGitHubTools } from './github/github.client';
import { createChatTools } from './google/chat.tools';
import { createDriveTools } from './google/drive.tools';
import { createGmailTools } from './google/gmail.tools';
import { GoogleSession } from './google/google.client';
import { createSlackTools } from './slack/slack.client';
import { createTelegramTools } from './telegram/telegram.client';

/** A connector node wired into an agent. */
export interface AgentConnector {
  kind: ConnectorKind;
  /** Lets the agent send email (Gmail) or open issues and comment (GitHub). */
  allowWrite: boolean;
}

export const CONNECTOR_KINDS: ConnectorKind[] = ['gmail', 'drive', 'gchat', 'slack', 'telegram', 'github'];

export function isConnectorKind(value: unknown): value is ConnectorKind {
  return CONNECTOR_KINDS.includes(value as ConnectorKind);
}

/** The tools an agent gets from the connector nodes wired into it, plus a prompt line for each. */
export async function createConnectorTools(
  store: ConnectorStore,
  userId: string,
  connectors: AgentConnector[],
): Promise<{ tools: Tool[]; notes: string[] }> {
  // Several nodes of one kind act as one; any of them allowing writes allows them.
  const byKind = new Map<ConnectorKind, boolean>();
  for (const connector of connectors) byKind.set(connector.kind, (byKind.get(connector.kind) ?? false) || connector.allowWrite);

  const tools: Tool[] = [];
  const notes: string[] = [];
  let google: GoogleSession | null = null;
  const googleSession = async () => (google ??= new GoogleSession(store, await store.require(userId, 'google')));

  for (const [kind, allowWrite] of byKind) {
    switch (kind) {
      case 'gmail': {
        const session = await googleSession();
        tools.push(...createGmailTools(session, allowWrite));
        notes.push(`Gmail (${session.email}): search and read email${allowWrite ? ', and send email' : ' (read-only)'}.`);
        break;
      }
      case 'drive': {
        const session = await googleSession();
        tools.push(...createDriveTools(session));
        notes.push(`Google Drive (${session.email}): search and read files (read-only).`);
        break;
      }
      case 'gchat': {
        const session = await googleSession();
        tools.push(...createChatTools(session));
        notes.push(`Google Chat (${session.email}): list spaces and read messages (read-only).`);
        break;
      }
      case 'slack': {
        const { data } = await store.require(userId, 'slack');
        tools.push(...createSlackTools(data.botToken, data.teamName));
        notes.push(`Slack (${data.teamName}): list channels, read channels the bot is in, and post messages.`);
        break;
      }
      case 'telegram': {
        const { data } = await store.require(userId, 'telegram');
        tools.push(...createTelegramTools(data.botToken, data.botUsername));
        notes.push(`Telegram (@${data.botUsername}): send messages to chats that have talked to the bot.`);
        break;
      }
      case 'github': {
        const { data } = await store.require(userId, 'github');
        tools.push(...createGitHubTools(data.token, data.login, allowWrite));
        notes.push(
          `GitHub (${data.login}): read repositories, issues, pull requests and files${allowWrite ? ', open issues and comment' : ' (read-only)'}.`,
        );
        break;
      }
    }
  }

  return { tools, notes };
}
