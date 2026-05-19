function CanvasNode({ className, label, title }: { className: string; label: string; title: string }) {
  return (
    <div className={`node absolute w-40 p-3 ${className}`}>
      <div className="l-text-faint text-[10px] font-bold uppercase tracking-[0.16em]">{label}</div>
      <div className="l-text mt-2 text-sm font-bold">{title}</div>
      <div className="landing-progress-track mt-3 h-1.5 w-full rounded-full">
        <div className="h-full w-2/3 rounded-full bg-violet-400" />
      </div>
    </div>
  );
}

export function ProductScreenshotSection() {
  return (
    <section id="product" className="relative px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="reveal mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="l-accent-cyan text-sm font-bold uppercase tracking-[0.24em]">Product</p>
            <h2 className="l-text mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">A complete control room for agent operations.</h2>
          </div>
          <p className="l-text-muted max-w-sm leading-7">The canvas, run history, and configuration panels stay together so teams can move fast without losing context.</p>
        </div>
        <div className="reveal glass overflow-hidden rounded-2xl shadow-glow">
          <div className="grid min-h-[620px] lg:grid-cols-[230px_1fr_270px]">
            <aside className="landing-sidebar border-b p-4 lg:border-b-0 lg:border-r">
              <div className="l-surface mb-5 h-9 rounded-lg" />
              {['Triggers', 'Agents', 'Models', 'Tools', 'Memory', 'Outputs'].map((item, index) => (
                <div key={item} className={`mb-2 rounded-lg px-3 py-2 text-sm ${index === 1 ? 'landing-sidebar-item-active' : 'landing-sidebar-item'}`}>
                  {item}
                </div>
              ))}
              <div className="landing-config-card mt-8 rounded-xl p-3">
                <div className="l-text-faint text-xs font-semibold">Runs today</div>
                <div className="l-text mt-2 text-2xl font-black">12,842</div>
              </div>
            </aside>
            <div className="l-canvas-bg dot-bg relative min-h-[460px]">
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 620 620" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="edgeGradProduct" x1="80" y1="160" x2="540" y2="430" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#22d3ee" />
                    <stop offset="1" stopColor="#8b5cf6" />
                  </linearGradient>
                  <linearGradient id="edgeGradCyanProduct" x1="120" y1="420" x2="520" y2="180" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#67e8f9" />
                    <stop offset="1" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
                <path className="edge-dash" d="M105 170 C220 170 205 285 310 285" stroke="url(#edgeGradProduct)" strokeWidth="2.5" />
                <path className="edge-dash" d="M385 285 C482 285 455 170 535 170" stroke="url(#edgeGradProduct)" strokeWidth="2.5" />
                <path className="edge-dash" d="M385 320 C480 350 455 440 535 440" stroke="url(#edgeGradCyanProduct)" strokeWidth="2.5" />
                <path className="edge-dash" d="M190 440 C250 390 250 330 310 320" stroke="url(#edgeGradCyanProduct)" strokeWidth="2.5" />
              </svg>
              <CanvasNode className="node-trigger left-[5%] top-[22%]" label="Webhook" title="Lead created" />
              <CanvasNode className="node-agent left-[38%] top-[42%]" label="Agent" title="Research buyer" />
              <CanvasNode className="node-agent right-[4%] top-[22%]" label="Tool" title="CRM enrich" />
              <CanvasNode className="node-output bottom-[18%] right-[4%]" label="Action" title="Send summary" />
              <CanvasNode className="node-agent bottom-[18%] left-[15%]" label="Eval" title="Score fit" />
            </div>
            <aside className="landing-sidebar border-t p-4 lg:border-l lg:border-t-0">
              <div className="mb-5">
                <div className="l-text-faint text-xs font-bold uppercase tracking-[0.18em]">Config</div>
                <h3 className="l-text mt-2 font-bold">Research buyer</h3>
              </div>
              {['Model', 'Temperature', 'Memory', 'Tool access'].map((item) => (
                <div key={item} className="landing-config-card mb-4 rounded-xl p-3">
                  <div className="l-text-faint text-xs">{item}</div>
                  <div className="landing-progress-track mt-2 h-2 rounded-full">
                    <div className="h-full w-3/4 rounded-full bg-cyan-400" />
                  </div>
                </div>
              ))}
              <button className="btn-primary-landing mt-3 w-full rounded-xl py-3 text-sm font-bold">Run workflow</button>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
