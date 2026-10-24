import type { NodeHandler } from './base.handler';
import type { ConnectorStore } from '../connectors/connector.store';
import { GMAIL_SEND_SCOPE, GoogleSession } from '../connectors/google/google.client';
import { sendGmail } from '../connectors/google/gmail.tools';
import { isTriggerEvent, replyToTrigger } from '../connectors/trigger-event';

export const REPLY_IN_CHAT = 'Reply in chat';
export const EMAIL_NOTIFICATION = 'Send email notification';

const MAX_RECIPIENTS = 5;
const EMAIL = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;

/** The addresses an email notification goes to, from the node's "Send to" field. */
function recipients(value: unknown): string[] {
  const list = String(value ?? '')
    .split(',')
    .map(address => address.trim())
    .filter(Boolean);
  if (list.length === 0) throw new Error('Set who gets the email notification in the Output node\'s "Send to" field.');
  if (list.length > MAX_RECIPIENTS) throw new Error(`An email notification can go to at most ${MAX_RECIPIENTS} addresses.`);
  const invalid = list.find(address => !EMAIL.test(address));
  if (invalid) throw new Error(`"${invalid}" isn't a valid email address.`);
  return list;
}

export class OutputHandler implements NodeHandler {
  constructor(private readonly store?: ConnectorStore) {}

  async execute(params: Record<string, unknown>, input: unknown): Promise<unknown> {
    const text = (typeof input === 'string' ? input : JSON.stringify(input, null, 2))?.trim() || '(no output)';

    // Replies only happen for runs a Slack or Telegram message started; a manual run just returns the output.
    if (params.outputMode === REPLY_IN_CHAT && isTriggerEvent(params.triggerEvent) && this.store) {
      await replyToTrigger(this.store, this.userIdOf(params), params.triggerEvent, text);
    }

    // Email notifications go out on every run, like a Slack or Telegram notification would.
    if (params.outputMode === EMAIL_NOTIFICATION && this.store) {
      const to = recipients(params.notifyEmail);
      const session = new GoogleSession(this.store, await this.store.require(this.userIdOf(params), 'google'));
      if (!session.hasScope(GMAIL_SEND_SCOPE)) {
        throw new Error('Google didn\'t grant permission to send email. Reconnect Google and tick "Send email on your behalf".');
      }
      const subject = typeof params.notifySubject === 'string' && params.notifySubject.trim()
        ? params.notifySubject
        : 'AgentFlow notification';
      await sendGmail(session, {
        to: to.join(', '),
        subject,
        body: `${text}\n\n--\nSent by your AgentFlow workflow. Change or turn off this notification in the workflow's Output step.`,
      });
    }

    return input;
  }

  private userIdOf(params: Record<string, unknown>): string {
    if (typeof params.userId !== 'string') throw new Error('Output node requires workflow owner userId.');
    return params.userId;
  }
}
