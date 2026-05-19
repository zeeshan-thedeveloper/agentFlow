import { LandingThemeToggle } from './LandingThemeToggle';

const links = ['Features', 'How it Works', 'Docs'];

export function NavBar() {
  return (
    <header id="landing-nav" className="fixed inset-x-0 top-0 z-50 transition-all duration-300">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <a href="#" className="flex items-center gap-3" aria-label="AgentFlow home">
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
            <rect width="34" height="34" rx="10" fill="#111119" />
            <path d="M11 17H23" stroke="url(#logoGrad)" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="10" cy="17" r="4.2" fill="#22d3ee" />
            <circle cx="24" cy="17" r="4.2" fill="#8b5cf6" />
            <defs>
              <linearGradient id="logoGrad" x1="9" y1="17" x2="25" y2="17" gradientUnits="userSpaceOnUse">
                <stop stopColor="#22d3ee" />
                <stop offset="1" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-lg font-bold tracking-tight text-white">AgentFlow</span>
        </a>
        <div className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a
              key={link}
              href={link === 'Docs' ? '#' : `#${link.toLowerCase().replaceAll(' ', '-')}`}
              className="text-sm font-medium text-white/60 transition hover:text-white"
            >
              {link}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <LandingThemeToggle />
          <a href="/login" className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-white/70 transition hover:text-white sm:block">
            Sign in
          </a>
          <a href="/login" className="btn-primary-landing rounded-lg px-4 py-2 text-sm font-semibold">
            Get Started Free
          </a>
        </div>
      </nav>
    </header>
  );
}
