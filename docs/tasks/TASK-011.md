# TASK-011 — Template Variable Interpolation (`{{input.x}}`)

**Phase:** 2  
**Status:** Done  
**Depends on:** TASK-005  
**Blocks:** —

---

## Context

Users write params like `["{{input.userId}}"]` or `{"email": "{{input.email}}"}` in the ConfigPanel. These placeholders reference the previous node's output. The `IntegrationHandler` must resolve them before passing `actionParams` to `integration.execute()`.

This is safe because `{{input.x}}` values end up as entries in a parameterized query array — they are never interpolated directly into SQL strings.

---

## What To Do

### 1. Create `apps/api/src/integrations/template.interpolator.ts`

```typescript
/**
 * Resolves {{input.field}} placeholders in param values using the previous node's output.
 *
 * Rules:
 * - Only string values in the params object are scanned.
 * - Nested paths are supported: {{input.user.id}}
 * - If a placeholder cannot be resolved (field doesn't exist), it is left as-is.
 * - This never touches SQL strings directly — it only replaces values in the params map.
 */
export function interpolateParams(
  params: Record<string, unknown>,
  input: unknown,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    result[key] = typeof value === 'string' ? resolveString(value, input) : value;
  }

  return result;
}

function resolveString(template: string, input: unknown): string {
  return template.replace(/\{\{input\.([^}]+)\}\}/g, (match, path: string) => {
    const resolved = getNestedValue(input, path.split('.'));
    if (resolved === undefined || resolved === null) return match; // leave placeholder if unresolvable
    return String(resolved);
  });
}

function getNestedValue(obj: unknown, keys: string[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
```

### 2. Call `interpolateParams` in `IntegrationHandler.execute()`

Open `apps/api/src/integrations/integration.handler.ts`. Update the `execute` method:

```typescript
import { interpolateParams } from './template.interpolator';

async execute(params: Record<string, unknown>, input: unknown): Promise<unknown> {
  const integrationId = String(params.integrationId ?? '');
  const actionId = String(params.actionId ?? '');
  const userId = String(params.userId ?? '');
  const rawActionParams = (params.actionParams ?? {}) as Record<string, unknown>;

  if (!integrationId) throw new Error('integrationId is required on integration nodes.');
  if (!actionId) throw new Error('actionId is required on integration nodes.');
  if (!userId) throw new Error('userId was not injected into integration node params.');

  const integration = integrationRegistry.get(integrationId);
  if (!integration) throw new Error(`Unknown integration: "${integrationId}".`);

  // Resolve {{input.x}} placeholders before passing to the integration
  const actionParams = interpolateParams(rawActionParams, input);

  const credentials = await this.credentialResolver.resolve(userId, integrationId);

  return integration.execute(actionId, actionParams, input, credentials);
}
```

### 3. Example of what this enables

Canvas node config (stored in `actionParams`):
```json
{
  "sql": "SELECT * FROM orders WHERE user_id = $1",
  "params": "[\"{{input.userId}}\"]",
  "limit": "50"
}
```

If the previous node output was `{ "userId": "usr_abc123", "name": "Alice" }`, then after interpolation:
```json
{
  "sql": "SELECT * FROM orders WHERE user_id = $1",
  "params": "[\"usr_abc123\"]",
  "limit": "50"
}
```

`params` is then parsed by `parseQueryParams` → `["usr_abc123"]` → passed as `$1` in the parameterized query.

---

## Acceptance Criteria

- [ ] `interpolateParams({ params: '["{{input.userId}}"]' }, { userId: 'abc' })` returns `{ params: '["abc"]' }`
- [ ] Nested paths: `interpolateParams({ x: '{{input.user.id}}' }, { user: { id: '42' } })` returns `{ x: '42' }`
- [ ] Unresolvable paths are left as-is: `interpolateParams({ x: '{{input.missing}}' }, {})` returns `{ x: '{{input.missing}}' }`
- [ ] Non-string values in params are passed through unchanged: `interpolateParams({ limit: 100 }, {})` returns `{ limit: 100 }`
- [ ] `IntegrationHandler.execute()` calls `interpolateParams` before calling `integration.execute()`
- [ ] TypeScript compiles with no errors
