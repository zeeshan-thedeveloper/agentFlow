export function AgentFlowLogo({ compact = false }: { compact?: boolean }) {
  const size = compact ? 28 : 34;

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect width="34" height="34" rx="10" fill="#111119" />
        <path d="M11 17H23" stroke="url(#logoGradLogin)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="10" cy="17" r="4.2" fill="#22d3ee" />
        <circle cx="24" cy="17" r="4.2" fill="#8b5cf6" />
        <defs>
          <linearGradient id="logoGradLogin" x1="9" y1="17" x2="25" y2="17" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22d3ee" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <span className={`font-bold tracking-tight text-white ${compact ? 'text-base' : 'text-lg'}`}>AgentFlow</span>
    </div>
  );
}
