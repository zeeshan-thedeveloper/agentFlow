function MiniNode({
  className,
  label,
  title,
}: {
  className: string;
  label: string;
  title: string;
}) {
  return (
    <div className={`node absolute w-36 p-3 shadow-glow-sm ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="l-text-faint l-surface rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em]">
          {label}
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </div>
      <div className="l-text text-xs font-bold">{title}</div>
    </div>
  );
}

export function LoginDecoration() {
  return (
    <div className="l-canvas-bg dot-bg relative mt-10 h-56 overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 480 224" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="loginEdgeGrad" x1="80" y1="80" x2="400" y2="140" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22d3ee" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <path
          className="edge-dash"
          d="M118 88 C180 88 175 112 238 112"
          stroke="url(#loginEdgeGrad)"
          strokeWidth="2"
          fill="none"
        />
        <path
          className="edge-dash"
          d="M298 112 C360 112 355 88 418 88"
          stroke="url(#loginEdgeGrad)"
          strokeWidth="2"
          fill="none"
        />
      </svg>
      <MiniNode className="node-trigger left-[6%] top-[22%]" label="Trigger" title="Webhook" />
      <MiniNode className="node-agent left-[38%] top-[38%]" label="Agent" title="Triage" />
      <MiniNode className="node-output right-[6%] top-[22%]" label="Output" title="Response" />
      <div className="l-overlay absolute bottom-3 left-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 backdrop-blur">
        <span className="pulse-dot" />
        <span className="l-text-faint text-[10px] font-medium">3 nodes · 1.2s</span>
      </div>
    </div>
  );
}
