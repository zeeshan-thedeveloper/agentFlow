/**
 * Resolves {{input.field}} placeholders in param values using the previous node's output.
 *
 * Rules:
 * - Only string values in the params object are scanned.
 * - Nested paths are supported: {{input.user.id}}
 * - If a placeholder cannot be resolved (field doesn't exist), it is left as-is.
 * - This never touches SQL strings directly; it only replaces values in the params map.
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
    if (resolved === undefined || resolved === null) return match;
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
