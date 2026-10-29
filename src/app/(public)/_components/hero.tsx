import { cn } from '@/lib';
import { Check, Phone } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { HERO_CAMPUSES, HERO_IMAGES, NAV_LINKS, ROUTES } from './content';
import { ButtonLink, Container, FOCUS_RING, TextLink } from './primitives';

/** "UP Manila, PGH, UP Diliman and UP System", read out in place of the turning names. */
const CAMPUS_LIST = `${HERO_CAMPUSES.slice(0, -1).join(', ')} and ${HERO_CAMPUSES.at(-1)}`;

export function Hero() {
  return (
    <div className="relative isolate flex min-h-svh flex-col text-white">
      <HeroBackground />
      <Container className="flex flex-1 flex-col">
        <SiteNav />
        <div className="grid flex-1 grid-cols-1 content-center items-center gap-8 pt-8 pb-12 md:gap-10 md:pt-12 md:pb-18 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-14 lg:pt-16 lg:pb-24">
          <div className="flex min-w-0 flex-col gap-5">
            <span className="text-[12px] font-bold tracking-[.08em] text-[#fbd5d5] uppercase">
              UP Manila · DRRM-H Program
            </span>
            <h1
              aria-label={`Incident reporting for ${CAMPUS_LIST}`}
              className="text-[38px] leading-[1.05] font-extrabold tracking-[-.02em] text-balance md:text-[48px] lg:text-[60px]"
            >
              Incident reporting for <CampusTurns />
            </h1>
            <p className="max-w-140 text-[17px] leading-[1.6] text-pretty text-[#fde8e8] md:text-[19px]">
              Report emergencies, count people during drills and follow every report live.
            </p>
            <ul className="mt-1 flex flex-wrap gap-x-5.5 gap-y-2.5">
              {['No account needed', 'Works without signal'].map((label) => (
                <li key={label} className="flex items-center gap-2 text-[14px] font-semibold">
                  <Check size={16} aria-hidden className="text-[#a6f4c5]" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <ReportCard />
        </div>
      </Container>
    </div>
  );
}

function SiteNav() {
  return (
    <header className="flex h-16 items-center gap-3 md:h-19">
      <Link
        href="/"
        className={cn('flex min-w-0 items-center gap-2.5 rounded-lg text-white', FOCUS_RING)}
      >
        <Image
          src="/irs-logo.png"
          alt="IRS logo"
          width={36}
          height={36}
          className="size-7 shrink-0 object-contain md:size-9"
        />
        <span className="hidden flex-col gap-px md:flex">
          <span className="text-[15px] leading-[1.2] font-extrabold">UPM DRRM-H</span>
          <span className="text-[12px] text-[#fbd5d5]">Incident Reporting System</span>
        </span>
        <span className="truncate text-[15px] leading-[1.2] font-extrabold md:hidden">
          DRRM-H IRS
        </span>
      </Link>
      <div className="flex-1" />
      <nav aria-label="Sections" className="mr-4 hidden items-center gap-7 lg:flex">
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={cn(
              'rounded text-[15px] font-medium text-white underline-offset-4 hover:underline',
              FOCUS_RING
            )}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <a
        href="tel:911"
        className={cn(
          'flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/30 bg-white/14 px-3.5 text-[14px] font-bold whitespace-nowrap text-white transition-colors hover:bg-white/20',
          FOCUS_RING
        )}
      >
        <Phone size={16} aria-hidden />
        Call 911
      </a>
      <Link
        href={ROUTES.signIn}
        className={cn(
          'text-brand-500 flex h-11 shrink-0 items-center rounded-full bg-surface px-4.5 text-[14px] font-bold whitespace-nowrap transition-[filter] hover:brightness-97',
          FOCUS_RING
        )}
      >
        Sign in
      </Link>
    </header>
  );
}

function ReportCard() {
  return (
    <div className="flex flex-col gap-5 rounded-[22px] bg-surface p-5 text-gray-900 shadow-[0_18px_40px_rgba(16,24,40,.22)] md:p-7">
      <div className="flex flex-col gap-2">
        <span className="text-brand-500 flex items-center gap-2 text-[12px] font-bold tracking-[.08em] uppercase">
          <span aria-hidden className="bg-brand-500 size-2 rounded-full" />
          For anyone on campus
        </span>
        <h2 className="text-[24px] leading-[1.2] font-extrabold">Report an emergency</h2>
        <p className="text-[15px] leading-[1.55] text-gray-600">
          Fire, injury, flooding or damage.
        </p>
      </div>
      <ButtonLink href={ROUTES.report} fullWidth>
        Report an emergency
      </ButtonLink>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[14px] font-medium text-gray-600">
        <Phone size={16} aria-hidden className="text-brand-500" />
        Life-threatening?
        <TextLink href="tel:911">Call 911</TextLink>
      </p>
      <div className="h-px bg-line" />
      <p className="text-[15px] font-bold">For ERT and DRRM-H staff</p>
      <ButtonLink href={ROUTES.signIn} variant="outline" fullWidth>
        Sign in
      </ButtonLink>
    </div>
  );
}

/**
 * The campus names stacked in one grid cell, each showing for 3s of a 12s loop. Pure CSS: the
 * `campus-turn` keyframes live in globals.css, and with reduced motion only the first name shows.
 */
function CampusTurns() {
  return (
    <span
      aria-hidden
      className="inline-grid overflow-hidden pb-[.08em] align-bottom text-[#fbd5d5]"
    >
      {HERO_CAMPUSES.map((name, i) => (
        <span
          key={name}
          className={cn(
            'animate-campus-turn col-start-1 row-start-1 whitespace-nowrap opacity-0 motion-reduce:animate-none',
            i === 0 && 'motion-reduce:opacity-100'
          )}
          style={{ animationDelay: `${i * 3}s` }}
        >
          {name}
        </span>
      ))}
    </span>
  );
}

/**
 * Four campus photos cross-fading every 4s under a maroon wash. Pure CSS: the `hero-fade`
 * keyframes live in globals.css, and with reduced motion only the first photo shows.
 */
function HeroBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-1 overflow-hidden bg-[#4d0e0e]"
    >
      {HERO_IMAGES.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes="100vw"
          preload={i === 0}
          className={cn(
            'animate-hero-fade object-cover opacity-0 motion-reduce:animate-none',
            i === 0 && 'motion-reduce:opacity-100'
          )}
          style={{ animationDelay: `${i * 4 - 1}s` }}
        />
      ))}
      <div className="absolute inset-0 bg-[rgba(77,14,14,.8)]" />
    </div>
  );
}
