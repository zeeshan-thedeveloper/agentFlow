// Credentials resolved from the encrypted DB record and passed to execute().
export interface ResolvedCredentials {
  connectionString?: string;
  apiKey?: string;
  accessToken?: string;
  [key: string]: string | undefined;
}

// Definition of a single param in an action's config form.
export interface ActionParamDef {
  name: string;
  label: string;
  type: 'string' | 'text' | 'number' | 'boolean' | 'select';
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { label: string; value: string }[];
  secret?: boolean;
}

// A single action an integration can perform.
export interface IntegrationActionDef {
  id: string;
  name: string;
  description: string;
  paramSchema: ActionParamDef[];
}

// Public metadata - safe to return to the frontend via GET /integrations.
export interface IntegrationMeta {
  id: string;
  name: string;
  description: string;
  authType: 'api_key' | 'oauth2' | 'connection_string' | 'none';
  credentialLabel?: string;
  actions: IntegrationActionDef[];
}

// Full interface that every integration class must implement.
export interface Integration extends IntegrationMeta {
  execute(
    actionId: string,
    params: Record<string, unknown>,
    input: unknown,
    credentials: ResolvedCredentials,
  ): Promise<unknown>;
}

export interface TablePermissions {
  read: boolean;
  insert: boolean;
  update: boolean;
  delete: boolean;
}

export interface SchemaConfig {
  tables: Record<string, TablePermissions>;
}
