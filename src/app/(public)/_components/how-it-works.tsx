import { STEPS } from './content';
import { Section, SectionHeading } from './primitives';

export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="muted" className="flex flex-col gap-10">
      <div className="flex max-w-160 flex-col gap-3">
        <SectionHeading>How it works</SectionHeading>
      </div>
      <ol className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex flex-col gap-3 rounded-[22px] border border-gray-200 bg-surface p-6"
          >
            <span
              aria-hidden
              className="bg-brand-solid font-landing-mono grid size-10 place-items-center rounded-full text-[14px] font-semibold text-white"
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="text-[17px] leading-[1.3] font-bold">{step.title}</h3>
            <p className="text-[15px] leading-[1.55] text-pretty text-gray-600">{step.desc}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
