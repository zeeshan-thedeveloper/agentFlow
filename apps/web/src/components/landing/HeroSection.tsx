function MiniNode({ className, label, title, meta }: { className: string; label: string; title: string; meta: string }) {
  return (
    <div className={`node absolute w-44 p-4 shadow-glow-sm ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="l-text-faint rounded-md l-surface px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em]">{label}</span>
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
      </div>
      <div className="l-text text-sm font-bold">{title}</div>
      <div className="l-text-faint mt-1 text-xs">{meta}</div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative px-5 pt-32 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          <div className="reveal l-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm">
            <span className="pulse-dot" />
            Multi-agent orchestration for production teams
          </div>
          <h1 className="reveal l-text mt-8 text-5xl font-black leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
            Build AI workflows on a <span className="gradient-text">visual canvas</span>
          </h1>
          <p className="reveal l-text-secondary mx-auto mt-6 max-w-2xl text-lg leading-8">
            Design, test, and deploy agentic systems with model routing, tools, memory, human review, and observability in one elegant workspace.
          </p>
          <div className="reveal mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/login" className="btn-primary-landing rounded-xl px-6 py-3 text-sm font-bold">
              Start building free
            </a>
            <a href="#product" className="btn-ghost-landing rounded-xl px-6 py-3 text-sm font-bold">
              View live canvas
            </a>
          </div>
        </div>

        <div className="reveal relative mx-auto mt-16 max-w-6xl">
          <div className="l-glow-violet absolute -inset-8 rounded-[32px] blur-3xl" />
          <div className="glass relative overflow-hidden rounded-2xl shadow-glow">
            <div className="l-surface flex h-12 items-center justify-between border-b px-4">
              <div className="flex gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-300/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
              </div>
              <div className="l-text-faint font-mono text-xs">agentflow://customer-support-triage</div>
              <div className="l-surface h-7 w-24 rounded-lg" />
            </div>
            <div className="l-canvas-bg dot-bg relative h-[470px] overflow-hidden">
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 960 470" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="edgeGrad" x1="160" y1="160" x2="780" y2="300" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#22d3ee" />
                    <stop offset="1" stopColor="#8b5cf6" />
                  </linearGradient>
                  <linearGradient id="edgeGradCyan" x1="260" y1="330" x2="760" y2="160" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#67e8f9" />
                    <stop offset="1" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
                <path className="edge-dash" d="M223 158 C340 158 330 235 450 235" stroke="url(#edgeGrad)" strokeWidth="2.5" fill="none" />
                <path className="edge-dash" d="M590 235 C704 235 690 155 800 155" stroke="url(#edgeGrad)" strokeWidth="2.5" fill="none" />
                <path className="edge-dash" d="M590 258 C700 288 682 338 800 338" stroke="url(#edgeGradCyan)" strokeWidth="2.5" fill="none" />
              </svg>
              <div className="l-overlay absolute left-5 top-5 flex gap-2 rounded-xl p-2 backdrop-blur">
                {['Select', 'Agent', 'Tool', 'Run'].map((item) => (
                  <span key={item} className="l-surface l-text-muted rounded-lg px-3 py-2 text-xs font-semibold">{item}</span>
                ))}
              </div>
              <MiniNode className="node-trigger left-[7%] top-[28%]" label="Trigger" title="New ticket" meta="Zendesk webhook" />
              <MiniNode className="node-agent left-[42%] top-[42%]" label="Agent" title="Triage specialist" meta="GPT-4.1 + policy memory" />
              <MiniNode className="node-agent right-[7%] top-[27%]" label="Tool" title="CRM lookup" meta="Fetch account history" />
              <MiniNode className="node-output bottom-[21%] right-[7%]" label="Output" title="Draft response" meta="Human approval gate" />
              <div className="l-overlay absolute bottom-5 left-5 rounded-xl p-3 backdrop-blur">
                <div className="l-text-faint mb-2 text-[10px] font-bold uppercase tracking-[0.18em]">Run trace</div>
                <div className="l-text-muted flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full bg-emerald-400" /> 4 nodes completed in 2.8s</div>
              </div>
              <div className="l-overlay absolute bottom-5 right-5 h-28 w-40 rounded-xl p-2 backdrop-blur">
                <div className="h-full rounded-lg border border-cyan-400/20 bg-cyan-400/5">
                  <div className="ml-4 mt-4 h-2 w-10 rounded-full bg-cyan-300/60" />
                  <div className="ml-16 mt-6 h-2 w-12 rounded-full bg-violet-400/70" />
                  <div className="ml-24 mt-5 h-2 w-8 rounded-full bg-emerald-400/70" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
