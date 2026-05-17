import type { Integration } from './integration.interfaces';
import { DatabaseIntegration } from './providers/database/database.integration';
import { MongoIntegration } from './providers/database/mongo.integration';

const registryMap = new Map<string, Integration>([
  ['database', new DatabaseIntegration()],
  ['database:mongo', new MongoIntegration()],
  ['database:pg', new DatabaseIntegration()],
  // add ['slack', new SlackIntegration()] etc. in future tickets
]);

export const integrationRegistry = {
  get(id: string): Integration | undefined {
    if (registryMap.has(id)) return registryMap.get(id);
    const lastColon = id.lastIndexOf(':');
    if (lastColon > 0) return this.get(id.slice(0, lastColon));
    return undefined;
  },

  getAll(): Integration[] {
    return [...new Map([...registryMap.values()].map((integration) => [integration.id, integration])).values()];
  },
};
