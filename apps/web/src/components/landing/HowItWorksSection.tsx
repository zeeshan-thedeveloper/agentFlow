const steps = [
  {
    step: '01',
    title: 'Sketch the workflow',
    description: 'Drag triggers, agents, models, and tools into a readable execution graph.',
    code: ['trigger: new_lead', 'agent: research_lead', 'tools: [crm, web_search]'],
  },
  {
    step: '02',
    title: 'Test every path',
    description: 'Run scenarios, inspect traces, compare models, and tune prompts before release.',
    code: ['scenario: enterprise_account', 'eval: response_quality >= 0.92', 'latency_budget: 4s'],
  },
  {
    step: '03',
    title: 'Deploy and observe',
    description: 'Publish with environment secrets, approvals, rollback history, and live run metrics.',
    code: ['env: production', 'approval: required', 'deploy: v24.05'],
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="reveal mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-violet-400">How it Works</p>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">From idea to production in one flow.</h2>
        </div>
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {steps.map((item) => (
            <article key={item.step} className="reveal rounded-2xl border border-white/[0.08] bg-ink-850/80 p-6">
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/[0.15] font-mono text-sm font-bold text-violet-300">
                {item.step}
              </div>
              <h3 className="text-xl font-bold text-white">{item.title}</h3>
              <p className="mt-3 min-h-[84px] leading-7 text-white/[0.55]">{item.description}</p>
              <div className="mt-6 rounded-xl border border-white/[0.08] bg-black/30 p-4 font-mono text-xs text-white/[0.62]">
                {item.code.map((line) => (
                  <div key={line} className="py-1">
                    <span className="text-cyan-300">$</span> {line}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
