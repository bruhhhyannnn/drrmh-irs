import { cn } from '@/lib';
import {
  AccessCta,
  AudienceSection,
  figtree,
  Hero,
  HotlinesSection,
  HowItWorks,
  PartnersBar,
  PrivacySection,
  QuoteSection,
  SiteFooter,
  splineSansMono,
  SummaryPreview,
  VisionMission,
} from './_components';

/** Public landing page — implements the "DRRM-H Landing Page v2" design. */
export default function LandingPage() {
  return (
    <div
      data-smooth-scroll
      className={cn(
        figtree.variable,
        splineSansMono.variable,
        'font-landing min-h-screen overflow-x-clip bg-white text-gray-900 antialiased'
      )}
    >
      <main>
        <Hero />
        <PartnersBar />
        <AudienceSection />
        <SummaryPreview />
        <HowItWorks />
        <PrivacySection />
        <QuoteSection />
        <VisionMission />
        <HotlinesSection />
        <AccessCta />
      </main>
      <SiteFooter />
    </div>
  );
}
