import Image from 'next/image';
import { QUOTE } from './content';
import { Eyebrow, Section } from './primitives';

export function QuoteSection() {
  return (
    <Section tone="inverse">
      <figure className="mx-auto flex max-w-215 flex-col gap-7">
        <Eyebrow tone="inverse">From the head of unit</Eyebrow>
        <blockquote className="text-[20px] leading-normal font-medium text-pretty md:text-[24px] lg:text-[28px]">
          “{QUOTE.text}”
        </blockquote>
        <figcaption className="flex items-center gap-4">
          <div className="size-16 shrink-0 overflow-hidden rounded-full bg-[#6b1a1a]">
            <Image
              src={QUOTE.photo}
              alt={QUOTE.author}
              width={64}
              height={64}
              className="size-full object-cover"
            />
          </div>
          <div className="flex flex-col gap-0.75">
            <span className="text-[16px] font-bold">{QUOTE.author}</span>
            <span className="text-[14px] leading-[1.45] text-[#fbd5d5]">{QUOTE.role}</span>
          </div>
        </figcaption>
      </figure>
    </Section>
  );
}
