const steps = [
  {
    step: '01',
    title: 'Build the workflow',
    description: 'Drag a trigger, agents and outputs onto the canvas, and wire in the apps and databases each agent may use.',
    code: ['trigger: slack_message', 'agent: support_agent', 'apps: [github, gmail]'],
  },
  {
    step: '02',
    title: 'Connect your accounts',
    description: 'Add your OpenAI key and connect Google, Slack, Telegram or GitHub, then choose what each agent is allowed to do.',
    code: ['openai: connected', 'gmail: read-only', 'github: read + comment'],
  },
  {
    step: '03',
    title: 'Run and watch',
    description: 'Click Run or let a chat message start it, follow each step live on the canvas, and review the results in History.',
    code: ['run: started from slack', 'steps: 3 of 3 done', 'output: replied in thread'],
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative px-5 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="reveal mx-auto max-w-3xl text-center">
          <p className="l-accent-violet text-sm font-bold uppercase tracking-[0.24em]">How it Works</p>
          <h2 className="l-text mt-4 text-4xl font-black tracking-tight sm:text-5xl">From idea to a working agent in one flow.</h2>
        </div>
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {steps.map((item) => (
            <article key={item.step} className="reveal l-card rounded-2xl p-6">
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/[0.15] font-mono text-sm font-bold l-accent-violet">
                {item.step}
              </div>
              <h3 className="l-text text-xl font-bold">{item.title}</h3>
              <p className="l-text-muted mt-3 min-h-[84px] leading-7">{item.description}</p>
              <div className="landing-code-block mt-6 rounded-xl p-4 font-mono text-xs">
                {item.code.map((line) => (
                  <div key={line} className="py-1">
                    <span className="l-accent-cyan">$</span> {line}
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
