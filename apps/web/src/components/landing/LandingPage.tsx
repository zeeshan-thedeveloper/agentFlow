import { CTABanner } from './CTABanner';
import { FeaturesSection } from './FeaturesSection';
import { Footer } from './Footer';
import { HeroSection } from './HeroSection';
import { HowItWorksSection } from './HowItWorksSection';
import { LandingScripts } from './LandingScripts';
import { LogoBar } from './LogoBar';
import { NavBar } from './NavBar';
import { ProductScreenshotSection } from './ProductScreenshotSection';

export function LandingPage() {
  return (
    <main className="landing-body min-h-screen overflow-x-hidden font-sans selection:bg-violet-500/30">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-60" />
      <NavBar />
      <HeroSection />
      <LogoBar />
      <FeaturesSection />
      <HowItWorksSection />
      <ProductScreenshotSection />
      <CTABanner />
      <Footer />
      <LandingScripts />
    </main>
  );
}
