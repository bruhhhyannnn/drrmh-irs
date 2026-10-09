import { cn } from '@/lib';
import Image from 'next/image';
import { CONTACT, ROUTES } from './content';
import { Container, FOCUS_RING, SmartLink } from './primitives';

const FOOTER_LINKS = [
  { label: 'Report an emergency', href: ROUTES.report },
  { label: 'Sign in', href: ROUTES.signIn },
  { label: 'Privacy notice', href: '#privacy' },
  { label: 'Hotlines', href: '#hotlines' },
];

const footerLink = cn('w-fit rounded hover:underline', FOCUS_RING);

export function SiteFooter() {
  return (
    <footer className="bg-gray-900 pt-14 pb-8 text-gray-300">
      <Container className="flex flex-col gap-8">
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3.5">
            <div className="flex items-center gap-2.5">
              <Image
                src="/irs-logo.png"
                alt="IRS logo"
                width={36}
                height={36}
                className="size-9 object-contain"
              />
              <span className="flex flex-col gap-px">
                <span className="text-[15px] leading-[1.2] font-extrabold text-white">
                  UPM DRRM-H
                </span>
                <span className="text-[12px] text-gray-400">Incident Reporting System</span>
              </span>
            </div>
            <p className="max-w-95 text-[14px] leading-[1.6] text-pretty">
              Emergency drill reporting for the UP Manila DRRM-H Center.
            </p>
          </div>

          <FooterColumn title="Contact">
            <a href={`mailto:${CONTACT.email}`} className={footerLink}>
              {CONTACT.email}
            </a>
            <a href={CONTACT.facebook} target="_blank" rel="noreferrer" className={footerLink}>
              DRRM-H Facebook
            </a>
            <span>{CONTACT.address}</span>
          </FooterColumn>

          <FooterColumn title="Links">
            {FOOTER_LINKS.map((link) => (
              <SmartLink key={link.label} href={link.href} className={footerLink}>
                {link.label}
              </SmartLink>
            ))}
          </FooterColumn>
        </div>

        <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-gray-800 pt-6 text-[13px] leading-normal text-gray-400">
          <span>© 2026 UP Manila DRRM-H — Incident Reporting System. All rights reserved.</span>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 text-[14px] leading-normal">
      <h2 className="text-[12px] font-bold tracking-[.08em] text-white uppercase">{title}</h2>
      {children}
    </div>
  );
}
