import type { FlowNode } from './types';
import { isValidConnection } from './handle-utils';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => { toBe: (expected: unknown) => void };

const nodes: FlowNode[] = [
  { id: 't1', type: 'trigger', label: 'Trigger', x: 0, y: 0 },
  { id: 's1', type: 'schema', label: 'Schema', x: 0, y: 0, integrationId: 'database.postgresql', connectionName: 'pg' },
  { id: 'a1', type: 'agent', label: 'Agent', x: 0, y: 0 },
  { id: 'd1', type: 'integration', label: 'DB', x: 0, y: 0, integrationId: 'database.postgresql' },
  { id: 'q1', type: 'query-runner', label: 'Query', x: 0, y: 0, integrationId: 'database.postgresql' },
  { id: 'o1', type: 'output', label: 'Output', x: 0, y: 0 },
];

describe('isValidConnection', () => {
  it('allows trigger-out to schema trigger-in', () => {
    expect(isValidConnection('t1', 'trigger-out', 's1', 'trigger-in', nodes)).toBe(true);
  });

  it('allows trigger-out to agent trigger-in', () => {
    expect(isValidConnection('t1', 'trigger-out', 'a1', 'trigger-in', nodes)).toBe(true);
  });

  it('rejects trigger-out to output data-in', () => {
    expect(isValidConnection('t1', 'trigger-out', 'o1', 'data-in', nodes)).toBe(false);
  });

  it('rejects schema to query', () => {
    expect(isValidConnection('s1', 'schema-out', 'd1', 'agent-in', nodes)).toBe(false);
  });

  it('allows agent text-out to output data-in', () => {
    expect(isValidConnection('a1', 'text-out', 'o1', 'data-in', nodes)).toBe(true);
  });

  it('allows agent text-out to query-runner query-in', () => {
    expect(isValidConnection('a1', 'text-out', 'q1', 'query-in', nodes)).toBe(true);
  });

  it('allows agent query-out to query-runner query-in', () => {
    expect(isValidConnection('a1', 'query-out', 'q1', 'query-in', nodes)).toBe(true);
  });

  it('allows database read-out to schema db-in', () => {
    expect(isValidConnection('d1', 'read-out', 's1', 'db-in', nodes)).toBe(true);
  });

  it('rejects database write-out to schema db-in', () => {
    expect(isValidConnection('d1', 'write-out', 's1', 'db-in', nodes)).toBe(false);
  });

  it('allows database write-out to query-runner db-in', () => {
    expect(isValidConnection('d1', 'write-out', 'q1', 'db-in', nodes)).toBe(true);
  });
});
