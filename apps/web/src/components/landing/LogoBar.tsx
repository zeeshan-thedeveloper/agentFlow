const providers = ['OpenAI', 'Anthropic', 'Google Gemini', 'Mistral', 'Groq', 'Ollama', 'Together AI'];

export function LogoBar() {
  return (
    <section className="relative px-5 py-20 sm:px-6 lg:px-8">
      <div className="reveal mx-auto max-w-6xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white/[0.35]">Works with the models you already use</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {providers.map((provider) => (
            <div key={provider} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-white/[0.62]">
              {provider}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
