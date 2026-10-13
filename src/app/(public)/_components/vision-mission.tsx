import { MISSION, VISION } from './content';
import { Eyebrow, Section, SectionHeading } from './primitives';

export function VisionMission() {
  return (
    <Section tone="muted" className="flex flex-col gap-10">
      <div className="flex max-w-160 flex-col gap-3">
        <SectionHeading>Vision and mission</SectionHeading>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {[
          { label: 'Vision', text: VISION },
          { label: 'Mission', text: MISSION },
        ].map((item) => (
          <div
            key={item.label}
            className="flex flex-col gap-3 rounded-[22px] border border-gray-200 bg-surface p-5 md:p-7"
          >
            <Eyebrow tone="meta">{item.label}</Eyebrow>
            <p className="text-[19px] leading-[1.55] font-medium text-pretty text-gray-900">
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
