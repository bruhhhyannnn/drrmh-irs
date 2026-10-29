import Image from 'next/image';
import { PARTNER_INSTITUTES, PARTNERS } from './content';
import { Container } from './primitives';

const { upri, noah } = PARTNER_INSTITUTES;

export function PartnersBar() {
  return (
    <div className="border-b border-line bg-surface">
      <Container className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 py-7">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          <span className="text-center text-[13px] font-semibold text-gray-500">
            Developed under the DRRM-H Program
          </span>
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            {PARTNERS.map((p) => (
              <li key={p.name}>
                <LogoName logo={p.logo} alt={p.alt} name={p.name} />
              </li>
            ))}
          </ul>
        </div>
        <span aria-hidden className="hidden h-8 w-px bg-line lg:block" />
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          <li>
            <LogoName logo={upri.logo} alt={upri.alt} name={upri.name} />
          </li>
          {/* A light chip, so the black wordmark still reads on the dark theme. */}
          <li data-theme="light" className="rounded-lg bg-surface p-1">
            <Image
              src={noah.logo}
              alt={noah.alt}
              width={85}
              height={30}
              className="h-7.5 w-auto object-contain"
            />
          </li>
        </ul>
      </Container>
    </div>
  );
}

function LogoName({ logo, alt, name }: { logo: string; alt: string; name: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <Image src={logo} alt={alt} width={40} height={40} className="size-10 object-contain" />
      <span className="text-[14px] font-semibold text-gray-700">{name}</span>
    </span>
  );
}
