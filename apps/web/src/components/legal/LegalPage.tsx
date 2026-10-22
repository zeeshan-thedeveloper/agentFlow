import type { ReactNode } from 'react';
import { Footer } from '@/components/landing/Footer';
import { NavBar } from '@/components/landing/NavBar';

export const CONTACT_EMAIL = 'zeeshanahmedd0010@gmail.com';
export const LAST_UPDATED = '22 October 2026';

/** Shared frame for the privacy policy and terms: landing header and footer around a readable column. */
export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <main className="landing-body min-h-screen overflow-x-hidden font-sans">
      <NavBar />
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-32 sm:px-6">
        <p className="l-text-faint text-sm">Last updated {LAST_UPDATED}</p>
        <h1 className="l-text mt-2 text-4xl font-bold tracking-tight">{title}</h1>
        <div className="l-text-secondary mt-5 text-base leading-7">{intro}</div>
        <div className="mt-10 flex flex-col gap-10">{children}</div>
      </article>
      <Footer />
    </main>
  );
}

export function LegalSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="l-text text-xl font-semibold">{title}</h2>
      <div className="l-text-secondary mt-3 flex flex-col gap-3 text-[15px] leading-7 [&_a]:underline [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </section>
  );
}

export function Email() {
  return <a href={`mailto:${CONTACT_EMAIL}`} className="l-link">{CONTACT_EMAIL}</a>;
}
