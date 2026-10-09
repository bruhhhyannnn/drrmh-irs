import { Shield } from 'lucide-react';
import { PRIVACY_POINTS } from './content';
import { CheckItem, Eyebrow, Section, SectionHeading } from './primitives';
import { PrivacyNoticeLead } from './privacy-notice-lead';

export function PrivacySection() {
  return (
    <Section
      id="privacy"
      className="grid grid-cols-1 items-start gap-8 md:gap-10 lg:grid-cols-2 lg:gap-16"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <span className="mb-1 grid size-12 place-items-center rounded-full bg-gray-100 text-gray-600">
          <Shield size={22} aria-hidden />
        </span>
        <Eyebrow>Privacy</Eyebrow>
        <SectionHeading>Protected under the Data Privacy Act of 2012</SectionHeading>
        <PrivacyNoticeLead />
      </div>
      <ul className="flex flex-col rounded-[22px] border border-[#eaecf0] bg-gray-50 px-6 py-1 text-[16px] leading-normal text-gray-700">
        {PRIVACY_POINTS.map((point) => (
          <CheckItem
            key={point}
            size={18}
            className="gap-3 border-t border-[#eaecf0] py-4.5 first:border-t-0"
          >
            {point}
          </CheckItem>
        ))}
      </ul>
    </Section>
  );
}
