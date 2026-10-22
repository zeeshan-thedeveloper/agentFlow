const features = [
  {
    title: 'Canvas-first workflows',
    description: 'Wire triggers, agents, databases, apps and outputs on a visual canvas, and choose which steps run together and in what order.',
    icon: 'M5 12h14M12 5v14M7 7h2M15 15h2',
  },
  {
    title: 'Agents with real tools',
    description: 'Agents run on OpenAI models and can search the web, read pages, call HTTP APIs and query your PostgreSQL database read-only.',
    icon: 'M6 8l6-4 6 4v8l-6 4-6-4V8zM12 4v16',
  },
  {
    title: 'Your apps as tools',
    description: 'Give agents Gmail, Google Drive, Slack, Telegram and GitHub. Sending email and making changes are off until you allow them on a node.',
    icon: 'M8 7h8v4H8zM5 15h14M7 19h10',
  },
  {
    title: 'Start from a chat',
    description: 'Mention your bot in Slack or message it on Telegram to start a workflow, and get the answer back in the same conversation.',
    icon: 'M12 5a4 4 0 014 4v2h1a2 2 0 012 2v4H5v-4a2 2 0 012-2h1V9a4 4 0 014-4z',
  },
  {
    title: 'Run history',
    description: 'See what started each run, every step’s output and the tools agents called. Runs from chat light up on the canvas as they happen.',
    icon: 'M4 16l4-5 4 3 5-7 3 4M4 20h16',
  },
  {
    title: 'Your keys, encrypted',
    description: 'Bring your own OpenAI and Tavily keys. Keys and app tokens are encrypted at rest and only used to run your workflows.',
    icon: 'M12 4v12M7 9l5-5 5 5M5 20h14',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="reveal max-w-2xl">
          <p className="l-accent-cyan text-sm font-bold uppercase tracking-[0.24em]">Features</p>
          <h2 className="l-text mt-4 text-4xl font-black tracking-tight sm:text-5xl">Everything you need to put agents to work.</h2>
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
