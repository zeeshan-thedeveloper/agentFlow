import { BrandMark } from '@/components/BrandMark';
import { LandingThemeToggle } from './LandingThemeToggle';

const links = ['Features', 'How it Works'];

export function NavBar() {
  return (
    <header id="landing-nav" className="nav-blur fixed inset-x-0 top-0 z-50 transition-all duration-300">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-3" aria-label="AgentFlow home">
          <BrandMark size={34} />
          <span className="l-text text-lg font-bold tracking-tight">AgentFlow</span>
        </a>
        <div className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a
              key={link}
              href={`/#${link.toLowerCase().replaceAll(' ', '-')}`}
              className="landing-nav-link text-sm font-medium"
            >
              {link}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <LandingThemeToggle />
          <a href="/login" className="landing-nav-link hidden rounded-lg px-4 py-2 text-sm font-semibold sm:block">
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
