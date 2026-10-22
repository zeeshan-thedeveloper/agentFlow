/**
 * Describes a value for the server logs without its content. Workflow inputs,
 * tool results and outputs can hold email, documents or chat messages, which
 * must not end up in logs; their shape is enough to debug a run.
 */
export function summarizeForLog(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `string(${value.length} chars)`;
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    return keys.length > 0 ? `object(keys: ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? ', …' : ''})` : 'object(empty)';
  }
  return typeof value;
}
