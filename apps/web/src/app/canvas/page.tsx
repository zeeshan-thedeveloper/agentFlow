import FlowCanvas from '@/components/FlowCanvas';

export default function CanvasPage() {
  return (
    <main className="flex h-screen flex-col bg-[#0D0D0F]">
      {/* ── Top bar ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#1f1f23] bg-[#111113] px-6 py-3">
        <span className="text-base font-semibold tracking-tight text-white">
          AgentFlow
        </span>
        <button className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500">
          Run
        </button>
      </header>

      {/* ── Canvas ── */}
      <div className="min-h-0 flex-1">
        <FlowCanvas />
      </div>
    </main>
  );
}
