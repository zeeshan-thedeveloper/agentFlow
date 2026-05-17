import type { Integration, IntegrationActionDef, ResolvedCredentials } from '../../integration.interfaces';
import { getMongoClient } from './mongo.connection';

const ACTIONS: IntegrationActionDef[] = [
  {
    id: 'find',
    name: 'Find Documents',
    description: 'Query documents from a collection',
    paramSchema: [
      { name: 'collection', label: 'Collection', type: 'string', required: true, placeholder: 'users' },
      {
        name: 'filter',
        label: 'Filter (JSON)',
        type: 'text',
        required: false,
        placeholder: '{"status": "active"}',
        description: 'MongoDB query filter. Leave blank to return all.',
      },
      { name: 'limit', label: 'Limit', type: 'number', required: false, placeholder: '100' },
      {
        name: 'projection',
        label: 'Projection (JSON)',
        type: 'text',
        required: false,
        placeholder: '{"name": 1, "email": 1}',
      },
    ],
  },
  {
    id: 'insertOne',
    name: 'Insert Document',
    description: 'Insert a single document into a collection',
    paramSchema: [
      { name: 'collection', label: 'Collection', type: 'string', required: true },
      {
        name: 'document',
        label: 'Document (JSON)',
        type: 'text',
        required: true,
        placeholder: '{"name": "{{input.name}}", "email": "{{input.email}}"}',
      },
    ],
  },
  {
    id: 'updateOne',
    name: 'Update Document',
    description: 'Update the first document matching a filter',
    paramSchema: [
      { name: 'collection', label: 'Collection', type: 'string', required: true },
      {
        name: 'filter',
        label: 'Filter (JSON)',
        type: 'text',
        required: true,
        placeholder: '{"_id": "{{input.id}}"}',
      },
      {
        name: 'update',
        label: 'Update (JSON)',
        type: 'text',
        required: true,
        placeholder: '{"$set": {"status": "processed"}}',
      },
    ],
  },
  {
    id: 'deleteOne',
    name: 'Delete Document',
    description: 'Delete the first document matching a filter',
    paramSchema: [
      { name: 'collection', label: 'Collection', type: 'string', required: true },
      {
        name: 'filter',
        label: 'Filter (JSON)',
        type: 'text',
        required: true,
        placeholder: '{"_id": "{{input.id}}"}',
      },
    ],
  },
];

const MAX_DOCS = 500;

export class MongoIntegration implements Integration {
  id = 'database:mongo';
  name = 'MongoDB';
  description = 'Query or write to a MongoDB database';
  authType = 'connection_string' as const;
  credentialLabel = 'MongoDB URI';
  actions = ACTIONS;

  async execute(
    actionId: string,
    params: Record<string, unknown>,
    _input: unknown,
    credentials: ResolvedCredentials,
  ): Promise<unknown> {
    const { connectionString } = credentials;
    if (!connectionString) throw new Error('No MongoDB URI found. Connect a database first.');

    switch (actionId) {
      case 'find':
        return this.runFind(connectionString, params);
      case 'insertOne':
        return this.runInsertOne(connectionString, params);
      case 'updateOne':
        return this.runUpdateOne(connectionString, params);
      case 'deleteOne':
        return this.runDeleteOne(connectionString, params);
      default:
        throw new Error(`Unknown action: ${actionId}`);
    }
  }

  private parseJSON(value: unknown, field: string): Record<string, unknown> {
    if (!value || value === '') return {};
    try {
      return typeof value === 'string' ? JSON.parse(value) : (value as Record<string, unknown>);
    } catch {
      throw new Error(`${field} must be valid JSON.`);
    }
  }

  private getDb(client: import('mongodb').MongoClient, uri: string) {
    const match = uri.match(/\/([^/?]+)(\?|$)/);
    return client.db(match?.[1] ?? 'test');
  }

  private async runFind(uri: string, params: Record<string, unknown>): Promise<unknown> {
    const collection = String(params.collection ?? '').trim();
    if (!collection) throw new Error('Collection name is required.');
    const filter = this.parseJSON(params.filter, 'Filter');
    const projection = this.parseJSON(params.projection, 'Projection');
    const limit = Math.min(params.limit ? Number(params.limit) : 100, MAX_DOCS);

    const client = await getMongoClient(uri);
    const docs = await this.getDb(client, uri)
      .collection(collection)
      .find(filter, { projection })
      .limit(limit)
      .toArray();

    return { documents: docs, count: docs.length };
  }

  private async runInsertOne(uri: string, params: Record<string, unknown>): Promise<unknown> {
    const collection = String(params.collection ?? '').trim();
    if (!collection) throw new Error('Collection name is required.');
    const document = this.parseJSON(params.document, 'Document');

    const client = await getMongoClient(uri);
    const result = await this.getDb(client, uri).collection(collection).insertOne(document);
    return { insertedId: result.insertedId, acknowledged: result.acknowledged };
  }

  private async runUpdateOne(uri: string, params: Record<string, unknown>): Promise<unknown> {
    const collection = String(params.collection ?? '').trim();
    if (!collection) throw new Error('Collection name is required.');
    const filter = this.parseJSON(params.filter, 'Filter');
    const update = this.parseJSON(params.update, 'Update');
    if (!Object.keys(filter).length) throw new Error('Filter is required. Refusing to update without a condition.');

    const client = await getMongoClient(uri);
    const result = await this.getDb(client, uri).collection(collection).updateOne(filter, update);
    return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
  }

  private async runDeleteOne(uri: string, params: Record<string, unknown>): Promise<unknown> {
    const collection = String(params.collection ?? '').trim();
    if (!collection) throw new Error('Collection name is required.');
    const filter = this.parseJSON(params.filter, 'Filter');
    if (!Object.keys(filter).length) throw new Error('Filter is required. Refusing to delete without a condition.');

    const client = await getMongoClient(uri);
    const result = await this.getDb(client, uri).collection(collection).deleteOne(filter);
    return { deletedCount: result.deletedCount };
  }
}
