import type { NodeHandler } from './base.handler';
import { isConnectorKind } from '../connectors/connector.tools';

/** A connector node does no work itself; it tells the agent it is wired into which app it can use. */
export class ConnectorHandler implements NodeHandler {
  async execute(params: Record<string, unknown>): Promise<unknown> {
    if (!isConnectorKind(params.connector)) {
      throw new Error(`Unknown connector: ${String(params.connector)}`);
    }
    return { kind: params.connector, allowWrite: params.allowWrite === true };
  }
}
