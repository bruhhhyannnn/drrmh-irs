import Image from 'next/image';
import { PARTNERS } from './content';
import { Container } from './primitives';

export function PartnersBar() {
  return (
    <div className="border-b border-line bg-surface">
      <Container className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 py-7">
        <span className="text-center text-[13px] font-semibold text-gray-500">
          Developed under the DRRM-H Program
        </span>
        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-4">
          {PARTNERS.map((p) => (
            <li key={p.name} className="flex items-center gap-2.5">
              <Image
                src={p.logo}
                alt={p.alt}
                width={40}
                height={40}
                className="size-10 object-contain"
              />
              <span className="text-[14px] font-semibold text-gray-700">{p.name}</span>
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}
