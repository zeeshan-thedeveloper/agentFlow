const columns = [
  { title: 'Product', links: ['Canvas', 'Model routing', 'Tracing', 'Deployments'] },
  { title: 'Resources', links: ['Docs', 'Templates', 'Changelog', 'Security'] },
  { title: 'Company', links: ['About', 'Careers', 'Contact', 'Status'] },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/[0.08] px-5 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
                <rect width="34" height="34" rx="10" fill="#111119" />
                <path d="M11 17H23" stroke="#8b5cf6" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="10" cy="17" r="4.2" fill="#22d3ee" />
                <circle cx="24" cy="17" r="4.2" fill="#8b5cf6" />
              </svg>
              <span className="text-lg font-bold text-white">AgentFlow</span>
            </div>
            <p className="mt-5 max-w-sm leading-7 text-white/50">A visual orchestration platform for teams building production-grade AI agents.</p>
            <div className="mt-6 flex gap-3">
              {['M6 18L18 6M8 6h10v10', 'M7 7h10v10H7zM4 4h10', 'M5 12h14M12 5v14'].map((path, index) => (
                <a key={path} href="#" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/[0.55] transition hover:text-white" aria-label={`Social link ${index + 1}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-white/[0.35]">{column.title}</h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-white/[0.55] transition hover:text-white">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col justify-between gap-4 border-t border-white/[0.08] pt-6 text-sm text-white/[0.35] sm:flex-row">
          <span>© 2026 AgentFlow. All rights reserved.</span>
          <div className="flex gap-5">
            <a href="#" className="hover:text-white">Privacy</a>
            <a href="#" className="hover:text-white">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
