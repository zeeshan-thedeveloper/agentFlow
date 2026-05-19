const providers = ['OpenAI', 'Anthropic', 'Google Gemini', 'Mistral', 'Groq', 'Ollama', 'Together AI'];

export function LogoBar() {
  return (
    <section className="relative px-5 py-20 sm:px-6 lg:px-8">
      <div className="reveal mx-auto max-w-6xl text-center">
        <p className="l-text-faint text-sm font-semibold uppercase tracking-[0.22em]">Works with the models you already use</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {providers.map((provider) => (
            <div key={provider} className="l-pill rounded-full px-5 py-2.5 text-sm font-semibold">
              {provider}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
