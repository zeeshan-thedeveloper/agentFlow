import { BrandMark } from '@/components/BrandMark';

export function AgentFlowLogo({ compact = false }: { compact?: boolean }) {
  const size = compact ? 28 : 34;

  return (
    <div className="flex items-center gap-3">
      <BrandMark size={size} />
      <span className={`l-text font-bold tracking-tight ${compact ? 'text-base' : 'text-lg'}`}>AgentFlow</span>
    </div>
  );
}
