const features = [
  {
    title: 'Canvas-first orchestration',
    description: 'Compose agents, tools, branches, approvals, and outputs with a node editor built for complex production flows.',
    icon: 'M5 12h14M12 5v14M7 7h2M15 15h2',
  },
  {
    title: 'Model routing',
    description: 'Route work across OpenAI, Anthropic, Gemini, local models, or custom endpoints based on cost, latency, and quality.',
    icon: 'M6 8l6-4 6 4v8l-6 4-6-4V8zM12 4v16',
  },
  {
    title: 'Tool and memory layer',
    description: 'Connect APIs, vector stores, browser actions, internal data, and reusable memories without brittle glue code.',
    icon: 'M8 7h8v4H8zM5 15h14M7 19h10',
  },
  {
    title: 'Human review gates',
    description: 'Pause workflows for approvals, edits, escalations, and audit trails before agents take sensitive actions.',
    icon: 'M12 5a4 4 0 014 4v2h1a2 2 0 012 2v4H5v-4a2 2 0 012-2h1V9a4 4 0 014-4z',
  },
  {
    title: 'Observability built in',
    description: 'Inspect traces, prompts, tool calls, latency, token spend, and version changes from every production run.',
    icon: 'M4 16l4-5 4 3 5-7 3 4M4 20h16',
  },
  {
    title: 'Deploy with confidence',
    description: 'Promote tested flows with secrets, environments, webhook triggers, and rollback-ready version history.',
    icon: 'M12 4v12M7 9l5-5 5 5M5 20h14',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="reveal max-w-2xl">
          <p className="l-accent-cyan text-sm font-bold uppercase tracking-[0.24em]">Features</p>
          <h2 className="l-text mt-4 text-4xl font-black tracking-tight sm:text-5xl">Everything teams need to ship reliable agents.</h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="reveal feature-card rounded-2xl p-6">
              <div className="l-surface mb-6 flex h-12 w-12 items-center justify-center rounded-xl shadow-glow-sm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d={feature.icon} stroke="currentColor" className="l-accent-violet" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="l-text text-lg font-bold">{feature.title}</h3>
              <p className="l-text-muted mt-3 leading-7">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
