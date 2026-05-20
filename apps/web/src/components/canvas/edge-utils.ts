export function edgeColor(sourceHandle?: string, targetHandle?: string): string {
  const handle = sourceHandle ?? targetHandle ?? '';
  if (handle.includes('text-trigger')) return '#A855F7';
  if (handle.includes('trigger')) return '#F59E0B';
  if (handle.includes('schema')) return '#8B5CF6';
  if (handle.includes('query') || handle === 'sql') return '#06B6D4';
  if (handle === 'db-in' || handle.includes('read') || handle.includes('write')) return '#10B981';
  return '#6C63FF';
}

export function buildEdgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1);
  const offset = Math.max(dx * 0.5, 80);
  return `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;
}

export function bezierMidpoint(x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
  const dx = Math.abs(x2 - x1);
  const offset = Math.max(dx * 0.5, 80);
  const c1x = x1 + offset;
  const c1y = y1;
  const c2x = x2 - offset;
  const c2y = y2;
  const t = 0.5;
  const mt = 1 - t;

  return {
    x: mt ** 3 * x1 + 3 * mt ** 2 * t * c1x + 3 * mt * t ** 2 * c2x + t ** 3 * x2,
    y: mt ** 3 * y1 + 3 * mt ** 2 * t * c1y + 3 * mt * t ** 2 * c2y + t ** 3 * y2,
  };
}

export function edgeHandleLabel(sourceHandle?: string, targetHandle?: string): string {
  const handle = sourceHandle ?? targetHandle ?? '';
  if (handle.includes('text-trigger')) return 'RUN+TEXT';
  if (handle.includes('trigger')) return 'TRIGGER';
  if (handle.includes('schema')) return 'SCHEMA';
  if (handle.includes('query') || handle === 'sql') return 'SQL';
  if (handle === 'db-in' || handle.includes('read') || handle.includes('write')) return 'DB';
  return 'DATA';
}
