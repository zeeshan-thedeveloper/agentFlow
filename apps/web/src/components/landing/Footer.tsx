import { BrandMark } from '@/components/BrandMark';

const columns = [
  { title: 'Product', links: [{ label: 'Features', href: '/#features' }, { label: 'How it works', href: '/#how-it-works' }, { label: 'Sign in', href: '/login' }] },
  { title: 'Legal', links: [{ label: 'Privacy Policy', href: '/privacy' }, { label: 'Terms of Service', href: '/terms' }] },
  { title: 'Contact', links: [{ label: 'Get in touch', href: 'https://www.zeeshanahmed.app/#contact' }, { label: 'About the maker', href: 'https://www.zeeshanahmed.app/' }] },
];

export function Footer() {
  return (
    <footer className="landing-footer relative px-5 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <BrandMark size={34} />
              <span className="l-text text-lg font-bold">AgentFlow</span>
            </div>
            <p className="l-text-muted mt-5 max-w-sm leading-7">A visual builder for AI agent workflows that work with your apps.</p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="l-text-faint text-sm font-bold uppercase tracking-[0.18em]">{column.title}</h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="landing-nav-link text-sm">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="landing-footer-divider l-text-faint mt-12 flex flex-col justify-between gap-4 pt-6 text-sm sm:flex-row">
          <span>© 2026 AgentFlow. All rights reserved.</span>
          <div className="flex gap-5">
            <a href="/privacy" className="landing-nav-link">Privacy</a>
            <a href="/terms" className="landing-nav-link">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
