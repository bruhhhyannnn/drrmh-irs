import { AUDIENCES } from './content';
import { ArrowLink, CheckItem, Eyebrow, Section, SectionHeading } from './primitives';

export function AudienceSection() {
  return (
    <Section id="who-its-for" tone="muted" className="flex flex-col gap-10">
      <div className="flex max-w-160 flex-col gap-3">
        <SectionHeading>Who it&apos;s for</SectionHeading>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {AUDIENCES.map(({ icon: Icon, eyebrow, title, points, cta }) => (
          <article
            key={eyebrow}
            className="flex flex-col gap-4.5 rounded-[22px] border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,.08)] md:p-7"
          >
            <span className="bg-brand-25 text-brand-500 grid size-12 place-items-center rounded-full">
              <Icon size={22} aria-hidden />
            </span>
            <div className="flex flex-col gap-1.5">
              <Eyebrow tone="meta">{eyebrow}</Eyebrow>
              <h3 className="text-[21px] leading-tight font-extrabold">{title}</h3>
            </div>
            <ul className="flex flex-col gap-3 text-[15px] leading-normal text-gray-700">
              {points.map((point) => (
                <CheckItem key={point}>{point}</CheckItem>
              ))}
            </ul>
            <div className="mt-auto border-t border-[#eaecf0] pt-4">
              <ArrowLink href={cta.href}>{cta.label}</ArrowLink>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
