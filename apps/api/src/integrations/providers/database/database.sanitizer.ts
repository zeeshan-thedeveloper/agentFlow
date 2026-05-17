export const MAX_ROWS = 1_000;
export const MAX_SQL_LENGTH = 10_000;

// Statements blocked on the 'query' action.
// The 'execute' action skips this guard (by design).
const BLOCKED_PATTERN =
  /^\s*(drop|truncate|alter|create\s+(?:table|index|view|schema|database)|grant|revoke)\b/i;

export function guardQuerySql(sql: string): void {
  if (sql.length > MAX_SQL_LENGTH) {
    throw new Error(`Query too long. Maximum allowed: ${MAX_SQL_LENGTH} characters.`);
  }
  if (BLOCKED_PATTERN.test(sql.trim())) {
    throw new Error(
      'Blocked statement. The "query" action only allows SELECT and read-only statements. ' +
        'Use the "execute" action for DML.',
    );
  }
}

// Parse and validate the params JSON array (e.g. '["value1", 42]').
// Returns the parsed array, or throws a descriptive error.
export function parseQueryParams(raw: unknown): unknown[] {
  if (raw === undefined || raw === null || raw === '') return [];

  let parsed: unknown;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new Error('Query params must be a valid JSON array. Example: ["value1", 42]');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Query params must be a JSON array, not an object or primitive.');
  }

  return parsed;
}

export function maskConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (url.password) url.password = '****';
    return url.toString();
  } catch {
    return connectionString.replace(/:\/\/([^:@]+):([^@]+)@/, '://$1:****@');
  }
}
