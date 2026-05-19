export function CTABanner() {
  return (
    <section className="relative px-5 py-24 sm:px-6 lg:px-8">
      <div className="reveal cta-banner mx-auto max-w-7xl overflow-hidden rounded-3xl p-8 text-center shadow-glow md:p-14">
        <h2 className="l-text mx-auto max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Build your first agent workflow today.</h2>
        <p className="l-text-secondary mx-auto mt-5 max-w-2xl leading-8">
          Start with a blank canvas, connect your preferred models, and turn repeatable work into reliable autonomous systems.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="/login" className="btn-primary-landing rounded-xl px-6 py-3 text-sm font-bold">Get started free</a>
          <a href="#features" className="btn-ghost-landing rounded-xl px-6 py-3 text-sm font-bold">
            Explore features
          </a>
        </div>
      </div>
    </section>
  );
}
