import type { Integration } from './integration.interfaces';
import { DatabaseIntegration } from './providers/database/database.integration';

const registryMap = new Map<string, Integration>([
  ['database', new DatabaseIntegration()],
  // add ['slack', new SlackIntegration()] etc. in future tickets
]);

export const integrationRegistry = {
  get(id: string): Integration | undefined {
    // Support named connections: 'database:prod' -> looks up 'database'
    const baseId = id.split(':')[0];
    return registryMap.get(baseId);
  },

  getAll(): Integration[] {
    return [...registryMap.values()];
  },
};
