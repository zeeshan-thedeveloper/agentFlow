export function CTABanner() {
  return (
    <section className="relative px-5 py-24 sm:px-6 lg:px-8">
      <div className="reveal cta-banner mx-auto max-w-7xl overflow-hidden rounded-3xl p-8 text-center shadow-glow md:p-14">
        <h2 className="mx-auto max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">Build your first agent workflow today.</h2>
        <p className="mx-auto mt-5 max-w-2xl leading-8 text-white/[0.62]">
          Start with a blank canvas, connect your preferred models, and turn repeatable work into reliable autonomous systems.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="/login" className="btn-primary-landing rounded-xl px-6 py-3 text-sm font-bold">Get started free</a>
          <a href="#features" className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-6 py-3 text-sm font-bold text-white/80 transition hover:bg-white/[0.08]">
            Explore features
          </a>
        </div>
      </div>
    </section>
  );
}
