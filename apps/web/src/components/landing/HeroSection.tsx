function MiniNode({ className, label, title, meta }: { className: string; label: string; title: string; meta: string }) {
  return (
    <div className={`node absolute w-44 p-4 shadow-glow-sm ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/[0.45]">{label}</span>
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
      </div>
      <div className="text-sm font-bold text-white">{title}</div>
      <div className="mt-1 text-xs text-white/[0.45]">{meta}</div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative px-5 pt-32 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          <div className="reveal inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/70">
            <span className="pulse-dot" />
            Multi-agent orchestration for production teams
          </div>
          <h1 className="reveal mt-8 text-5xl font-black leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Build AI workflows on a <span className="gradient-text">visual canvas</span>
          </h1>
          <p className="reveal mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/[0.62]">
            Design, test, and deploy agentic systems with model routing, tools, memory, human review, and observability in one elegant workspace.
          </p>
          <div className="reveal mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="/login" className="btn-primary-landing rounded-xl px-6 py-3 text-sm font-bold">
              Start building free
            </a>
            <a href="#product" className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-bold text-white/80 transition hover:bg-white/[0.06]">
              View live canvas
            </a>
          </div>
        </div>

        <div className="reveal relative mx-auto mt-16 max-w-6xl">
          <div className="absolute -inset-8 rounded-[32px] bg-violet-600/20 blur-3xl" />
          <div className="glass relative overflow-hidden rounded-2xl shadow-glow">
            <div className="flex h-12 items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4">
              <div className="flex gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-300/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
              </div>
              <div className="font-mono text-xs text-white/[0.35]">agentflow://customer-support-triage</div>
              <div className="h-7 w-24 rounded-lg bg-white/[0.04]" />
            </div>
            <div className="relative h-[470px] overflow-hidden bg-ink-950 dot-bg">
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
              <div className="absolute left-5 top-5 flex gap-2 rounded-xl border border-white/[0.08] bg-black/25 p-2 backdrop-blur">
                {['Select', 'Agent', 'Tool', 'Run'].map((item) => (
                  <span key={item} className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/60">{item}</span>
                ))}
              </div>
              <MiniNode className="node-trigger left-[7%] top-[28%]" label="Trigger" title="New ticket" meta="Zendesk webhook" />
              <MiniNode className="node-agent left-[42%] top-[42%]" label="Agent" title="Triage specialist" meta="GPT-4.1 + policy memory" />
              <MiniNode className="node-agent right-[7%] top-[27%]" label="Tool" title="CRM lookup" meta="Fetch account history" />
              <MiniNode className="node-output bottom-[21%] right-[7%]" label="Output" title="Draft response" meta="Human approval gate" />
              <div className="absolute bottom-5 left-5 rounded-xl border border-white/[0.08] bg-black/25 p-3 backdrop-blur">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/[0.35]">Run trace</div>
                <div className="flex items-center gap-2 text-xs text-white/60"><span className="h-2 w-2 rounded-full bg-emerald-400" /> 4 nodes completed in 2.8s</div>
              </div>
              <div className="absolute bottom-5 right-5 h-28 w-40 rounded-xl border border-white/[0.08] bg-black/25 p-2 backdrop-blur">
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
